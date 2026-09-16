use tauri::State;

use crate::services::DiskOverview;
use crate::services::Ec2ConnectionManager;

#[tauri::command(async)]
pub fn get_remote_disk_overview(
    state: State<'_, Ec2ConnectionManager>,
) -> Result<DiskOverview, String> {
    state.get_disk_overview()
}
