mod common;
mod linux;
mod macos;

use ssh2::Session;

pub use common::DiskOverview;

use super::remote_fs::exec_remote_command;

/// 원격 `uname -s` 결과. 대시보드 기능 노출 여부에 사용.
pub fn detect_remote_os(session: &Session) -> String {
    match exec_remote_command(session, "uname -s 2>/dev/null") {
        Ok(value) if value.eq_ignore_ascii_case("Darwin") => "macos".to_string(),
        Ok(value) if value.eq_ignore_ascii_case("Linux") => "linux".to_string(),
        _ => "unknown".to_string(),
    }
}

pub fn get_disk_overview(session: &Session) -> Result<DiskOverview, String> {
    let os = detect_remote_os(session);

    let (filesystems, large_directories) = match os.as_str() {
        "macos" => {
            // 루트 `du`는 /Users·/System 전량 스캔으로 수분 걸릴 수 있어 건너뜁니다.
            (macos::list_filesystems(session)?, Vec::new())
        }
        // linux·unknown·windows: GNU df / du 가정 (SSH 유닉스 계열)
        _ => (
            linux::list_filesystems(session)?,
            linux::list_large_directories(session)?,
        ),
    };

    Ok(DiskOverview {
        os,
        filesystems,
        large_directories,
    })
}
