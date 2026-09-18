use ssh2::Session;

use super::common::{parse_df_output, sort_filesystems, DiskFilesystem};
use super::super::remote_fs::exec_remote_command;

/// BSD `df -kP` 기반 파일시스템 목록. 가상·보조 마운트는 제외한다.
pub fn list_filesystems(session: &Session) -> Result<Vec<DiskFilesystem>, String> {
    let output = exec_remote_command(session, "df -kP -l 2>/dev/null")?;
    let mut filesystems = parse_df_output(&output, 1024);
    filesystems.retain(|fs| !is_noise_mount(&fs.mounted_on));
    sort_filesystems(&mut filesystems);
    Ok(filesystems)
}

fn is_noise_mount(mounted_on: &str) -> bool {
    mounted_on.starts_with("/System/Volumes/Data/home")
        || mounted_on.starts_with("/private/var/vm")
        || mounted_on == "/dev"
        || mounted_on.starts_with("/Volumes/com.apple")
}
