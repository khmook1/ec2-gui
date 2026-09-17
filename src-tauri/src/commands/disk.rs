use tauri::State;

use crate::services::DiskOverview;
use crate::services::DiskUsageSample;
use crate::services::RemotePermissionOverview;
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
