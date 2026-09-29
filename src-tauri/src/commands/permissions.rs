use tauri::State;

use crate::services::CreateRemoteUserInput;
use crate::services::RemoteUser;
use crate::services::SshConnectionManager;

#[tauri::command(async)]
pub fn list_remote_users(
    state: State<'_, SshConnectionManager>,
) -> Result<Vec<RemoteUser>, String> {
    state.list_remote_users()
}

#[tauri::command(async)]
pub fn list_remote_groups(state: State<'_, SshConnectionManager>) -> Result<Vec<String>, String> {
    state.list_remote_groups()
}

#[tauri::command(async)]
pub fn add_remote_user_group(
    state: State<'_, SshConnectionManager>,
    username: String,
    group: String,
) -> Result<(), String> {
    state.add_remote_user_group(&username, &group)
}

#[tauri::command(async)]
pub fn remove_remote_user_group(
    state: State<'_, SshConnectionManager>,
    username: String,
    group: String,
) -> Result<(), String> {
    state.remove_remote_user_group(&username, &group)
}

#[tauri::command(async)]
pub fn set_remote_user_passwordless_sudo(
    state: State<'_, SshConnectionManager>,
    username: String,
    enabled: bool,
) -> Result<(), String> {
    state.set_remote_user_passwordless_sudo(&username, enabled)
}

#[tauri::command(async)]
pub fn create_remote_user(
    state: State<'_, SshConnectionManager>,
    input: CreateRemoteUserInput,
) -> Result<(), String> {
    state.create_remote_user(&input)
}

#[tauri::command(async)]
pub fn delete_remote_user(
    state: State<'_, SshConnectionManager>,
    username: String,
    remove_home: bool,
) -> Result<(), String> {
    state.delete_remote_user(&username, remove_home)
}
