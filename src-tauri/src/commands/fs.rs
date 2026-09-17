use tauri::State;

use crate::services::SshConnectionManager;
use crate::services::RemoteDirectoryListing;
use crate::services::remote_fs::RemoteFileContent;

// `async`: SSH I/O가 웹뷰 메인 스레드를 막아 모달/목록 페인트가 지연되지 않도록 한다.
#[tauri::command(async)]
pub fn get_remote_home(state: State<'_, SshConnectionManager>) -> Result<String, String> {
    state.get_home_directory()
}

#[tauri::command(async)]
pub fn list_remote_directory(
    path: String,
    state: State<'_, SshConnectionManager>,
) -> Result<RemoteDirectoryListing, String> {
    state.list_directory(&path)
}

#[tauri::command(async)]
pub fn create_remote_directory(
    path: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.create_directory(&path)
}

#[tauri::command(async)]
pub fn create_remote_file(
    path: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.create_file(&path)
}

#[tauri::command(async)]
pub fn delete_remote_path(
    path: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.delete_path(&path)
}

#[tauri::command(async)]
pub fn read_remote_file(
    path: String,
    state: State<'_, SshConnectionManager>,
) -> Result<RemoteFileContent, String> {
    state.read_file(&path)
}
