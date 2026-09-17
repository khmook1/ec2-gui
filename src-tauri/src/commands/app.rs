use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLoginDefaults {
    /// macOS에서만 true. 그 외 OS에서는 버튼 비활성.
    pub available: bool,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub memo: String,
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

#[tauri::command]
pub fn get_local_login_defaults() -> LocalLoginDefaults {
    if !cfg!(target_os = "macos") {
        return LocalLoginDefaults {
            available: false,
            host: String::new(),
            port: 22,
            username: String::new(),
            memo: String::new(),
        };
    }

    let username = std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_default();

    LocalLoginDefaults {
        available: true,
        host: "127.0.0.1".to_string(),
        port: 22,
        username,
        memo: "로컬 맥".to_string(),
    }
}
