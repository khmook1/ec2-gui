use tauri::State;

use crate::services::DockerContainer;
use crate::services::DockerContainerDetails;
use crate::services::DockerImage;
use crate::services::DockerNetwork;
use crate::services::DockerOverview;
use crate::services::DockerVolume;
use crate::services::SshConnectionManager;

// `async` 속성: sync 본문이라도 메인 스레드가 아닌 blocking pool에서 실행되어
// SSH I/O 중 웹뷰 페인트(모달 즉시 표시)가 막히지 않는다.
#[tauri::command(async)]
pub fn check_remote_docker(state: State<'_, SshConnectionManager>) -> Result<bool, String> {
    state.is_docker_installed()
}

#[tauri::command(async)]
pub fn list_remote_docker_containers(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<DockerContainer>, String> {
    state.list_docker_containers()
}

#[tauri::command(async)]
pub fn list_remote_docker_images(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<DockerImage>, String> {
    state.list_docker_images()
}

#[tauri::command(async)]
pub fn list_remote_docker_networks(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<DockerNetwork>, String> {
    state.list_docker_networks()
}

#[tauri::command(async)]
pub fn list_remote_docker_volumes(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<DockerVolume>, String> {
    state.list_docker_volumes()
}

#[tauri::command(async)]
pub fn get_remote_docker_overview(
    state: State<'_, SshConnectionManager>,
) -> Result<DockerOverview, String> {
    state.get_docker_overview()
}

#[tauri::command(async)]
pub fn run_remote_docker_container_action(
    container_id: String,
    action: String,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.docker_container_action(&container_id, &action)
}

#[tauri::command(async)]
pub fn run_remote_docker_image_action(
    image_ref: String,
    action: String,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.docker_image_action(&image_ref, &action)
}

#[tauri::command(async)]
pub fn run_remote_docker_volume_action(
    volume_name: String,
    action: String,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.docker_volume_action(&volume_name, &action)
}

#[tauri::command(async)]
pub fn run_remote_docker_network_action(
    network_ref: String,
    action: String,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.docker_network_action(&network_ref, &action)
}

#[tauri::command(async)]
pub fn run_remote_docker_system_action(
    action: String,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.docker_system_action(&action)
}

#[tauri::command(async)]
pub fn get_remote_docker_container_details(
    container_id: String,
    state: State<'_, SshConnectionManager>,
) -> Result<DockerContainerDetails, String> {
    state.docker_container_details(&container_id)
}

#[tauri::command(async)]
pub fn get_remote_docker_container_logs(
    container_id: String,
    tail: u32,
    since: Option<String>,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.docker_container_logs(&container_id, tail, since.as_deref().unwrap_or(""))
}
