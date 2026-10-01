use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

const SETTINGS_FILE_NAME: &str = "settings.json";
const FAVORITES_FILE_NAME: &str = "favorites.json";
const WALLPAPER_DIR_NAME: &str = "wallpapers";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStoragePaths {
    pub app_data: String,
    pub settings_file: String,
    pub favorites_file: String,
    pub server_history: String,
    pub wallpapers: String,
    pub cache: String,
    pub logs: String,
    pub webview_data: String,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StorageLocation {
    AppData,
    SettingsFile,
    FavoritesFile,
    ServerHistory,
    Wallpapers,
    Cache,
    Logs,
    WebviewData,
}

fn resolve_webview_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let path = app.path();

    #[cfg(target_os = "macos")]
    {
        let webkit = path
            .home_dir()
            .map_err(|error| format!("home dir: {error}"))?
            .join("Library")
            .join("WebKit");
        let by_identifier = webkit.join(&app.config().identifier);
        if by_identifier.exists() {
            return Ok(by_identifier);
        }
        let by_exe = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.file_stem().map(|stem| webkit.join(stem)))
            .filter(|dir| dir.exists());
        Ok(by_exe.unwrap_or(by_identifier))
    }

    #[cfg(target_os = "windows")]
    {
        Ok(path
            .app_local_data_dir()
            .map_err(|error| format!("app local data dir: {error}"))?
            .join("EBWebView"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        path.app_local_data_dir()
            .map_err(|error| format!("app local data dir: {error}"))
    }
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
    let webview_data = resolve_webview_data_dir(app)?;

    Ok(AppStoragePaths {
        settings_file: app_data
            .join(SETTINGS_FILE_NAME)
            .to_string_lossy()
            .into_owned(),
        favorites_file: app_data
            .join(FAVORITES_FILE_NAME)
            .to_string_lossy()
            .into_owned(),
        server_history: app_data
            .join(super::local_history::HISTORY_DIR_NAME)
            .to_string_lossy()
            .into_owned(),
        wallpapers: app_data
            .join(WALLPAPER_DIR_NAME)
            .to_string_lossy()
            .into_owned(),
        app_data: app_data.to_string_lossy().into_owned(),
        cache: cache.to_string_lossy().into_owned(),
        logs: logs.to_string_lossy().into_owned(),
        webview_data: webview_data.to_string_lossy().into_owned(),
    })
}

pub fn ensure_dirs(paths: &AppStoragePaths) -> Result<(), String> {
    for dir in [
        PathBuf::from(&paths.app_data),
        PathBuf::from(&paths.cache),
        PathBuf::from(&paths.logs),
        PathBuf::from(&paths.wallpapers),
        PathBuf::from(&paths.server_history),
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

pub fn open_location<R: Runtime>(
    app: &AppHandle<R>,
    location: StorageLocation,
) -> Result<(), String> {
    let paths = resolve_and_ensure(app)?;
    let target = match location {
        StorageLocation::AppData => paths.app_data,
        StorageLocation::SettingsFile => paths.settings_file,
        StorageLocation::FavoritesFile => paths.favorites_file,
        StorageLocation::ServerHistory => paths.server_history,
        StorageLocation::Wallpapers => paths.wallpapers,
        StorageLocation::Cache => paths.cache,
        StorageLocation::Logs => paths.logs,
        StorageLocation::WebviewData => paths.webview_data,
    };
    reveal_in_file_manager(Path::new(&target))
}

fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    let (target, is_file) = if path.is_file() {
        (path, true)
    } else if path.is_dir() {
        (path, false)
    } else {
        let parent = path
            .parent()
            .filter(|parent| parent.is_dir())
            .ok_or_else(|| format!("경로가 아직 없습니다: {}", path.to_string_lossy()))?;
        (parent, false)
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        if is_file {
            command.arg("-R");
        }
        command.arg(target);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        if is_file {
            command.arg(format!("/select,{}", target.to_string_lossy()));
        } else {
            command.arg(target);
        }
        command
    };

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = {
        let folder = if is_file {
            target.parent().unwrap_or(target)
        } else {
            target
        };
        let mut command = Command::new("xdg-open");
        command.arg(folder);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("폴더를 열지 못했습니다: {error}"))
}
