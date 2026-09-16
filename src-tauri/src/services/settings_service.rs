use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{AppHandle, Runtime};

use super::storage_service;

const WALLPAPER_DIR: &str = "wallpapers";
const WALLPAPER_FILE_STEM: &str = "current";

fn wallpaper_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let paths = storage_service::resolve_and_ensure(app)?;
    Ok(PathBuf::from(paths.app_data).join(WALLPAPER_DIR))
}

fn guess_mime(extension: &str) -> &'static str {
    match extension.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    }
}

pub fn set_wallpaper_from_path<R: Runtime>(
    app: &AppHandle<R>,
    source_path: &str,
) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.is_file() {
        return Err("선택한 이미지 파일을 찾을 수 없습니다.".to_string());
    }

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();

    let allowed = ["jpg", "jpeg", "png", "webp", "gif"];
    if !allowed.contains(&extension.as_str()) {
        return Err("지원하지 않는 이미지 형식입니다. (jpg, png, webp, gif)".to_string());
    }

    let dir = wallpaper_dir(app)?;
    clear_wallpaper_files(&dir)?;

    let dest = dir.join(format!("{WALLPAPER_FILE_STEM}.{extension}"));
    fs::copy(source, &dest).map_err(|error| format!("배경 이미지 복사 실패: {error}"))?;

    encode_file_as_data_url(&dest)
}

pub fn clear_wallpaper_image<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let dir = wallpaper_dir(app)?;
    clear_wallpaper_files(&dir)
}

fn clear_wallpaper_files(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_file() {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn encode_file_as_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("배경 이미지 읽기 실패: {error}"))?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");
    let mime = guess_mime(extension);
    Ok(format!(
        "data:{mime};base64,{}",
        STANDARD.encode(bytes)
    ))
}
