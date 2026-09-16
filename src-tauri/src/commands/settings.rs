use std::path::PathBuf;

use tauri::AppHandle;

use crate::services::{cache_service, settings_service, storage_service};

#[tauri::command]
pub fn get_storage_paths(app: AppHandle) -> Result<storage_service::AppStoragePaths, String> {
    storage_service::resolve_and_ensure(&app)
}

#[tauri::command]
pub fn clear_app_cache(app: AppHandle) -> Result<(), String> {
    let paths = storage_service::resolve_and_ensure(&app)?;
    cache_service::clear_cache_dir(&PathBuf::from(paths.cache))
}

#[tauri::command]
pub fn set_wallpaper_image(app: AppHandle, source_path: String) -> Result<String, String> {
    settings_service::set_wallpaper_from_path(&app, &source_path)
}

#[tauri::command]
pub fn clear_wallpaper_image(app: AppHandle) -> Result<(), String> {
    settings_service::clear_wallpaper_image(&app)
}
