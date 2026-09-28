use serde::Serialize;
use tauri::State;

use crate::services::SshConnectionManager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectResult {
    pub connection_id: String,
    pub host: String,
    pub username: String,
    pub port: u16,
    pub auth_method: String,
}

#[tauri::command]
pub fn connect_ssh(
    host: String,
    username: String,
    port: Option<u16>,
    auth_method: String,
    private_key_path: Option<String>,
    key_passphrase: Option<String>,
    password: Option<String>,
    state: State<'_, SshConnectionManager>,
) -> Result<SshConnectResult, String> {
    let key_passphrase = key_passphrase.filter(|value| !value.is_empty());
    let password = password.filter(|value| !value.is_empty());

    let (connection_id, host, username, port, auth_method) = state.connect(
        &host,
        &username,
        port,
        &auth_method,
        private_key_path.as_deref(),
        key_passphrase.as_deref(),
        password.as_deref(),
    )?;

    Ok(SshConnectResult {
        connection_id,
        host,
        username,
        port,
        auth_method,
    })
}

#[tauri::command]
pub fn disconnect_ssh(state: State<'_, SshConnectionManager>) -> Result<(), String> {
    let _ = state.close_all_shells();
    state.disconnect()
}

#[tauri::command]
pub fn disconnect_ssh_session(
    connection_id: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.disconnect_session(&connection_id)
}

#[tauri::command]
pub fn set_active_ssh_session(
    connection_id: String,
    state: State<'_, SshConnectionManager>,
) -> Result<(), String> {
    state.set_active_session(&connection_id)
}
