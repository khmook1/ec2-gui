use tauri::State;

use crate::services::DockerContainer;
use crate::services::DockerContainerDetails;
use crate::services::Ec2ConnectionManager;

// `async` 속성: sync 본문이라도 메인 스레드가 아닌 blocking pool에서 실행되어
// SSH I/O 중 웹뷰 페인트(모달 즉시 표시)가 막히지 않는다.
#[tauri::command(async)]
pub fn check_remote_docker(state: State<'_, Ec2ConnectionManager>) -> Result<bool, String> {
    state.is_docker_installed()
}

#[tauri::command(async)]
pub fn list_remote_docker_containers(
    state: State<'_, Ec2ConnectionManager>,
) -> Result<Vec<DockerContainer>, String> {
    state.list_docker_containers()
}

#[tauri::command(async)]
pub fn run_remote_docker_container_action(
    container_id: String,
    action: String,
    state: State<'_, Ec2ConnectionManager>,
) -> Result<String, String> {
    state.docker_container_action(&container_id, &action)
}

#[tauri::command(async)]
pub fn get_remote_docker_container_details(
    container_id: String,
    state: State<'_, Ec2ConnectionManager>,
) -> Result<DockerContainerDetails, String> {
    state.docker_container_details(&container_id)
}

#[tauri::command(async)]
pub fn get_remote_docker_container_logs(
    container_id: String,
    tail: u32,
    since: Option<String>,
    state: State<'_, Ec2ConnectionManager>,
) -> Result<String, String> {
    state.docker_container_logs(&container_id, tail, since.as_deref().unwrap_or(""))
}
