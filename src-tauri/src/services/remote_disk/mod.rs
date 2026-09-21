mod common;
mod linux;
mod macos;

use ssh2::Session;

pub use common::{DiskOverview, LargeDirectory};

use super::remote_fs::exec_remote_command;

/// 원격 `uname -s` 결과. 대시보드 기능 노출 여부에 사용.
pub fn detect_remote_os(session: &Session) -> String {
    match exec_remote_command(session, "uname -s 2>/dev/null") {
        Ok(value) if value.eq_ignore_ascii_case("Darwin") => "macos".to_string(),
        Ok(value) if value.eq_ignore_ascii_case("Linux") => "linux".to_string(),
        _ => "unknown".to_string(),
    }
}

/// 빠른 경로: OS 감지 + `df`만. `du`는 세션을 오래 막아 파일 리스트를 지연시키므로 제외.
pub fn get_disk_overview(session: &Session) -> Result<DiskOverview, String> {
    let os = detect_remote_os(session);

    let filesystems = match os.as_str() {
        "macos" => macos::list_filesystems(session)?,
        _ => linux::list_filesystems(session)?,
    };

    Ok(DiskOverview {
        os,
        filesystems,
        large_directories: Vec::new(),
    })
}

/// 대용량 디렉터리 스캔 (후순위). 연결·파일 목록과 분리해 호출한다.
pub fn get_large_directories(session: &Session) -> Result<Vec<LargeDirectory>, String> {
    match detect_remote_os(session).as_str() {
        "macos" => macos::list_large_directories(session),
        "linux" => linux::list_large_directories(session),
        _ => Ok(Vec::new()),
    }
}
