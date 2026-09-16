use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStoragePaths {
    pub app_data: String,
    pub cache: String,
    pub logs: String,
}

pub fn resolve_paths<R: Runtime>(app: &AppHandle<R>) -> Result<AppStoragePaths, String> {
    let path = app.path();
    let app_data = path
        .app_data_dir()
        .map_err(|error| format!("app data dir: {error}"))?;
    let cache = path
        .app_cache_dir()
        .map_err(|error| format!("app cache dir: {error}"))?;
    let logs = path
        .app_log_dir()
        .map_err(|error| format!("app log dir: {error}"))?;

    Ok(AppStoragePaths {
        app_data: app_data.to_string_lossy().into_owned(),
        cache: cache.to_string_lossy().into_owned(),
        logs: logs.to_string_lossy().into_owned(),
    })
}

pub fn ensure_dirs(paths: &AppStoragePaths) -> Result<(), String> {
    for dir in [
        PathBuf::from(&paths.app_data),
        PathBuf::from(&paths.cache),
        PathBuf::from(&paths.logs),
        PathBuf::from(&paths.app_data).join("wallpapers"),
    ] {
        fs::create_dir_all(&dir).map_err(|error| {
            format!(
                "디렉터리 생성 실패 ({}): {error}",
                dir.to_string_lossy()
            )
        })?;
    }
    Ok(())
}

pub fn resolve_and_ensure<R: Runtime>(app: &AppHandle<R>) -> Result<AppStoragePaths, String> {
    let paths = resolve_paths(app)?;
    ensure_dirs(&paths)?;
    Ok(paths)
}
