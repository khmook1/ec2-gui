use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: option_env!("APP_NAME")
            .unwrap_or("App")
            .trim()
            .to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}
