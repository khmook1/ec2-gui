use tauri::State;

use crate::services::DiskOverview;
use crate::services::SshConnectionManager;

#[tauri::command(async)]
pub fn get_remote_disk_overview(
    state: State<'_, SshConnectionManager>,
) -> Result<DiskOverview, String> {
    state.get_disk_overview()
}
