use tauri::{AppHandle, State};

use crate::services::SshConnectionManager;

#[tauri::command]
pub fn open_ssh_shell(
    cols: u32,
    rows: u32,
    app: AppHandle,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.open_shell(cols, rows, &app)
}

#[tauri::command]
pub fn write_ssh_shell(
    shell_id: String,
    data: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.write_shell(&shell_id, &data)
}

#[tauri::command]
pub fn resize_ssh_shell(
    shell_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.resize_shell(&shell_id, cols, rows)
}

#[tauri::command]
pub fn close_ssh_shell(
    shell_id: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.close_shell(&shell_id)
}

#[tauri::command]
pub fn close_all_ssh_shells(state: State<'_, SshConnectionManager>) -> Result<(), String> {
    state.close_all_shells()
}
