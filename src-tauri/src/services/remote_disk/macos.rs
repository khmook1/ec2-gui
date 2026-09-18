use ssh2::Session;

use super::common::{
    parse_df_output, parse_large_directories, sort_filesystems_macos, DiskFilesystem,
    LargeDirectory,
};
use super::super::remote_fs::exec_remote_command;

/// BSD `df -kP` 기반 파일시스템 목록. Data 볼륨을 우선 정렬한다.
pub fn list_filesystems(session: &Session) -> Result<Vec<DiskFilesystem>, String> {
    let output = exec_remote_command(session, "df -kP -l 2>/dev/null")?;
    let mut filesystems = parse_df_output(&output, 1024);
    filesystems.retain(|fs| !is_noise_mount(&fs.mounted_on));
    sort_filesystems_macos(&mut filesystems);
    Ok(filesystems)
}

/// `/Users`·`/Applications`·`/Library` 1depth만 측정 (루트 전체 `du` 회피).
pub fn list_large_directories(session: &Session) -> Result<Vec<LargeDirectory>, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e
# BSD du: KiB 단위. 디바이스 경계 유지(-x), depth 1(-d 1)
for root in /Users /Applications /Library; do
  [ -d "$root" ] || continue
  du -x -d 1 -k "$root" 2>/dev/null
done | sort -nr | head -n 15
"#,
    )?;

    let mut directories = parse_large_directories(&output);
    for dir in &mut directories {
        dir.size_bytes = dir.size_bytes.saturating_mul(1024);
    }
    // 스캔 루트 자체 합계는 하위와 중복될 수 있어 제외
    directories.retain(|d| {
        d.path != "/Users" && d.path != "/Applications" && d.path != "/Library"
    });
    Ok(directories)
}

fn is_noise_mount(mounted_on: &str) -> bool {
    mounted_on.starts_with("/System/Volumes/Data/home")
        || mounted_on.starts_with("/private/var/vm")
        || mounted_on == "/dev"
        || mounted_on.starts_with("/Volumes/com.apple")
}
