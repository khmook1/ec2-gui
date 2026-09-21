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

/// 주요 경로 1depth 용량. 경로마다 짧은 타임아웃으로 SSH 세션 점유를 제한한다.
///
/// `/Users`·`/Library` 전체 `du`는 수분 걸릴 수 있어, 경로별 상한(초) 안에
/// 끝나지 않으면 해당 루트는 건너뛴다.
pub fn list_large_directories(session: &Session) -> Result<Vec<LargeDirectory>, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e
# 경로별 최대 4초. perl alarm으로 du가 SSH 채널을 무기한 점유하지 않게 함.
run_du() {
  root="$1"
  [ -d "$root" ] || return 0
  perl -e 'alarm 4; exec @ARGV' du -x -d 1 -k "$root" 2>/dev/null || true
}

# Applications 먼저(상대적으로 작음), Users·Library는 타임아웃에 걸릴 수 있음
{
  run_du /Applications
  run_du /Users
  run_du /Library
} | sort -nr | head -n 15
"#,
    )?;

    let mut directories = parse_large_directories(&output);
    for dir in &mut directories {
        dir.size_bytes = dir.size_bytes.saturating_mul(1024);
    }
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
