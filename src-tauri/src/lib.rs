mod commands;
mod services;
mod utils;

use services::storage_service;
use services::Ec2ConnectionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(Ec2ConnectionManager::new())
        .setup(|app| {
            storage_service::resolve_and_ensure(app.handle())
                .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::ec2::connect_ec2,
            commands::ec2::disconnect_ec2,
            commands::fs::get_remote_home,
            commands::fs::list_remote_directory,
            commands::fs::create_remote_directory,
            commands::fs::create_remote_file,
            commands::fs::delete_remote_path,
            commands::fs::read_remote_file,
            commands::docker::check_remote_docker,
            commands::docker::list_remote_docker_containers,
            commands::docker::run_remote_docker_container_action,
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
