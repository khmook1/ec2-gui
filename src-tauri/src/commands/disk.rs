use tauri::State;

use crate::services::BlockDevice;
use crate::services::DiskExpandResult;
use crate::services::DiskExpandStatus;
use crate::services::DiskOverview;
use crate::services::DiskUsageSample;
use crate::services::LargeDirectory;
use crate::services::RemotePermissionOverview;
use crate::services::ResourceHistoryDays;
use crate::services::ResourceHistorySample;
use crate::services::RemoteSshSession;
use crate::services::SshConnectionManager;
use crate::services::SystemResources;

#[tauri::command(async)]
pub fn get_remote_disk_overview(
    state: State<'_, SshConnectionManager>,
) -> Result<DiskOverview, String> {
    state.get_disk_overview()
}

#[tauri::command(async)]
pub fn get_remote_large_directories(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<LargeDirectory>, String> {
    state.get_large_directories()
}

#[tauri::command(async)]
pub fn get_remote_system_resources(
    state: State<'_, SshConnectionManager>,
) -> Result<SystemResources, String> {
    state.get_system_resources()
}

#[tauri::command(async)]
pub fn list_remote_ssh_sessions(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<RemoteSshSession>, String> {
    state.list_ssh_sessions()
}

#[tauri::command(async)]
pub fn get_remote_permission_overview(
    state: State<'_, SshConnectionManager>,
) -> Result<RemotePermissionOverview, String> {
    state.get_permission_overview()
}

#[tauri::command(async)]
pub fn ensure_remote_disk_history(
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.ensure_disk_history_collector()
}

#[tauri::command(async)]
pub fn get_remote_disk_history(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<DiskUsageSample>, String> {
    state.get_disk_history()
}

#[tauri::command(async)]
pub fn ensure_remote_resource_history(
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.ensure_resource_history_collector()
}

#[tauri::command(async)]
pub fn list_remote_resource_history_days(
    state: State<'_, SshConnectionManager>,
) -> Result<ResourceHistoryDays, String> {
    state.list_resource_history_days()
}

#[tauri::command(async)]
pub fn get_remote_resource_history(
    state: State<'_, SshConnectionManager>,
    date: String,
    since_ts: Option<u64>,
) -> Result<Vec<ResourceHistorySample>, String> {
    state.get_resource_history(&date, since_ts)
}

#[tauri::command(async)]
pub fn get_remote_block_devices(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<BlockDevice>, String> {
    state.list_block_devices()
}

#[tauri::command(async)]
pub fn get_remote_disk_expand_status(
    state: State<'_, SshConnectionManager>,
) -> Result<DiskExpandStatus, String> {
    state.get_disk_expand_status()
}

#[tauri::command(async)]
pub fn expand_remote_disk(
    state: State<'_, SshConnectionManager>,
    target_size_gb: Option<u64>,
) -> Result<DiskExpandResult, String> {
    state.expand_remote_disk(target_size_gb)
}
