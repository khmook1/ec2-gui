use serde::Serialize;
use tauri::State;

use crate::services::Ec2ConnectionManager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ec2ConnectResult {
    pub host: String,
    pub username: String,
    pub port: u16,
    pub auth_method: String,
}

#[tauri::command]
pub fn connect_ec2(
    host: String,
    username: String,
    port: Option<u16>,
    auth_method: String,
    private_key_path: Option<String>,
    key_passphrase: Option<String>,
    password: Option<String>,
    state: State<'_, Ec2ConnectionManager>,
) -> Result<Ec2ConnectResult, String> {
    let key_passphrase = key_passphrase.filter(|value| !value.is_empty());
    let password = password.filter(|value| !value.is_empty());

    let (host, username, port, auth_method) = state.connect(
        &host,
        &username,
        port,
        &auth_method,
        private_key_path.as_deref(),
        key_passphrase.as_deref(),
        password.as_deref(),
    )?;

    Ok(Ec2ConnectResult {
        host,
        username,
        port,
        auth_method,
    })
}

#[tauri::command]
pub fn disconnect_ec2(state: State<'_, Ec2ConnectionManager>) -> Result<(), String> {
    let _ = state.close_all_shells();
    state.disconnect()
}
