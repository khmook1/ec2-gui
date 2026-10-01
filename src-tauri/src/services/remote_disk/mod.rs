mod block_devices;
mod common;
mod linux;
mod macos;

use ssh2::Session;

pub use block_devices::{BlockDevice, DiskExpandResult, DiskExpandStatus};
pub use common::{DiskFilesystem, DiskOverview, LargeDirectory};

use super::remote_fs::exec_remote_command;

/// 원격 `uname -s` 결과. 대시보드 기능 노출 여부에 사용.
pub fn detect_remote_os(session: &Session) -> String {
    match exec_remote_command(session, "uname -s 2>/dev/null") {
        Ok(value) if value.eq_ignore_ascii_case("Darwin") => "macos".to_string(),
        Ok(value) if value.eq_ignore_ascii_case("Linux") => "linux".to_string(),
        _ => "unknown".to_string(),
    }
}

/// 빠른 경로: `df`만. `du`는 세션을 오래 막아 파일 리스트를 지연시키므로 제외.
pub fn get_disk_overview(session: &Session, os: &str) -> Result<DiskOverview, String> {
    let filesystems = match os {
        "macos" => macos::list_filesystems(session)?,
        _ => linux::list_filesystems(session)?,
    };

    Ok(DiskOverview {
        os: os.to_string(),
        filesystems,
        large_directories: Vec::new(),
    })
}

/// 대용량 디렉터리 스캔. 디스크 I/O를 쓰므로 사용자가 요청할 때만 호출한다.
pub fn get_large_directories(session: &Session, os: &str) -> Result<Vec<LargeDirectory>, String> {
    match os {
        "macos" => macos::list_large_directories(session),
        "linux" => linux::list_large_directories(session),
        _ => Ok(Vec::new()),
    }
}

pub fn list_block_devices(session: &Session, os: &str) -> Result<Vec<BlockDevice>, String> {
    block_devices::list_block_devices(session, os)
}

pub fn get_expand_status(session: &Session, os: &str) -> Result<DiskExpandStatus, String> {
    block_devices::get_expand_status(session, os)
}

pub fn expand_disk(
    session: &Session,
    os: &str,
    target_size_gb: Option<u64>,
) -> Result<DiskExpandResult, String> {
    block_devices::expand_disk(session, os, target_size_gb)
}
