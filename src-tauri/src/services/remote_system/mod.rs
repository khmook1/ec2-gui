use serde::Serialize;
use ssh2::Session;

use super::remote_disk::detect_remote_os;

mod linux;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuResource {
    pub cores: u32,
    pub load1: f64,
    pub use_percent: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryResource {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub use_percent: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkResource {
    pub interface: String,
    pub rx_bytes_per_sec: u64,
    pub tx_bytes_per_sec: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemResources {
    pub cpu: CpuResource,
    pub memory: MemoryResource,
    pub network: NetworkResource,
}

/// OS에 맞는 시스템 리소스 스냅샷을 조회한다.
pub fn get_system_resources(session: &Session) -> Result<SystemResources, String> {
    let os = detect_remote_os(session);
    match os.as_str() {
        "linux" => linux::get_system_resources(session),
        _ => Err("시스템 리소스는 Linux에서만 지원합니다.".to_string()),
    }
}
