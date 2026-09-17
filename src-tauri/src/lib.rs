mod commands;
mod services;
mod utils;

use services::storage_service;
use services::SshConnectionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(SshConnectionManager::new())
        .setup(|app| {
            storage_service::resolve_and_ensure(app.handle())
                .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::get_local_login_defaults,
            commands::ssh::connect_ssh,
            commands::ssh::disconnect_ssh,
            commands::fs::get_remote_home,
            commands::fs::list_remote_directory,
            commands::fs::create_remote_directory,
            commands::fs::create_remote_file,
            commands::fs::delete_remote_path,
            commands::fs::read_remote_file,
            commands::fs::write_remote_file,
            commands::disk::get_remote_disk_overview,
            commands::disk::get_remote_system_resources,
            commands::disk::list_remote_ssh_sessions,
            commands::disk::get_remote_permission_overview,
            commands::disk::ensure_remote_disk_history,
            commands::disk::get_remote_disk_history,
            commands::docker::check_remote_docker,
            commands::docker::list_remote_docker_containers,
            commands::docker::list_remote_docker_images,
            commands::docker::list_remote_docker_networks,
            commands::docker::list_remote_docker_volumes,
            commands::docker::get_remote_docker_overview,
            commands::docker::run_remote_docker_container_action,
            commands::docker::run_remote_docker_image_action,
            commands::docker::run_remote_docker_volume_action,
            commands::docker::run_remote_docker_network_action,
            commands::docker::run_remote_docker_system_action,
            commands::docker::get_remote_docker_container_details,
            commands::docker::get_remote_docker_container_logs,
            commands::settings::get_storage_paths,
            commands::settings::clear_app_cache,
            commands::settings::set_wallpaper_image,
            commands::settings::clear_wallpaper_image,
            commands::ssh_shell::open_ssh_shell,
            commands::ssh_shell::write_ssh_shell,
            commands::ssh_shell::resize_ssh_shell,
            commands::ssh_shell::close_ssh_shell,
            commands::ssh_shell::close_all_ssh_shells
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
