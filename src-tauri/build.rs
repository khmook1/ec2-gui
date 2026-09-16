use std::fs;
use std::path::PathBuf;

fn load_app_name_from_env_file(path: PathBuf) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(value) = line.strip_prefix("APP_NAME=") {
            let value = value.trim().trim_matches('"').trim_matches('\'');
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn resolve_app_name() -> String {
    if let Ok(value) = std::env::var("APP_NAME") {
        let value = value.trim().to_string();
        if !value.is_empty() {
            return value;
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .map(PathBuf::from)
        .unwrap_or(manifest_dir);

    // 프론트와 동일하게 .env → .env.local 순으로 조회
    for file_name in [".env.local", ".env"] {
        if let Some(name) = load_app_name_from_env_file(project_root.join(file_name)) {
            return name;
        }
    }

    "App".to_string()
}

fn main() {
    let app_name = resolve_app_name();
    println!("cargo:rerun-if-env-changed=APP_NAME");
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-changed=../.env.local");
    println!("cargo:rustc-env=APP_NAME={}", app_name);
    tauri_build::build()
}
