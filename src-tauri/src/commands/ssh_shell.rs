use tauri::{AppHandle, State};

use crate::services::SshConnectionManager;

// `async`: 채널 열기·PTY 요청 등 원격 왕복과 연결 락 대기가 메인 스레드를 막아 앱 전체가 멈추지 않도록 한다.
#[tauri::command(async)]
pub fn open_ssh_shell(
    cols: u32,
    rows: u32,
    app: AppHandle,
    state: State<'_, SshConnectionManager>,
) -> Result<String, String> {
    state.open_shell(cols, rows, &app)
}

#[tauri::command(async)]
pub fn write_ssh_shell(
    shell_id: String,
    data: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.write_shell(&shell_id, &data)
}

#[tauri::command(async)]
pub fn resize_ssh_shell(
    shell_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.resize_shell(&shell_id, cols, rows)
}

#[tauri::command(async)]
pub fn close_ssh_shell(
    shell_id: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.close_shell(&shell_id)
}

#[tauri::command(async)]
pub fn close_all_ssh_shells(state: State<'_, SshConnectionManager>) -> Result<(), String> {
    state.close_all_shells()
}
