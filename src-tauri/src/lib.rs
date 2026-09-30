mod commands;
mod services;
mod utils;

use services::storage_service;
use services::SshConnectionManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(SshConnectionManager::new())
        .setup(|app| {
            if let Some(manager) = app.try_state::<SshConnectionManager>() {
                manager.bind_app(app.handle().clone());
            }
            storage_service::resolve_and_ensure(app.handle())
                .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::get_local_login_defaults,
            commands::ssh::connect_ssh,
            commands::ssh::disconnect_ssh,
            commands::ssh::disconnect_ssh_session,
            commands::ssh::set_active_ssh_session,
            commands::fs::get_remote_home,
            commands::fs::list_remote_directory,
            commands::fs::create_remote_directory,
            commands::fs::create_remote_file,
            commands::fs::delete_remote_path,
            commands::fs::read_remote_file,
            commands::fs::write_remote_file,
            commands::fs::list_remote_favorites,
            commands::fs::set_remote_favorite,
            commands::disk::get_remote_disk_overview,
            commands::disk::get_remote_large_directories,
            commands::disk::get_remote_system_resources,
            commands::disk::list_remote_ssh_sessions,
            commands::disk::get_remote_permission_overview,
            commands::permissions::list_remote_users,
            commands::permissions::list_remote_groups,
            commands::permissions::add_remote_user_group,
            commands::permissions::remove_remote_user_group,
            commands::permissions::set_remote_user_passwordless_sudo,
            commands::permissions::create_remote_user,
            commands::permissions::delete_remote_user,
            commands::disk::ensure_remote_disk_history,
            commands::disk::get_remote_disk_history,
            commands::disk::ensure_remote_resource_history,
            commands::disk::list_remote_resource_history_days,
            commands::disk::get_remote_resource_history,
            commands::disk::get_remote_block_devices,
            commands::disk::get_remote_disk_expand_status,
            commands::disk::expand_remote_disk,
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
            commands::docker::list_remote_docker_favorites,
            commands::docker::set_remote_docker_favorite,
            commands::github::open_external_url,
            commands::github::get_github_viewer,
            commands::github::list_github_repos,
            commands::github::get_github_repo,
            commands::github::get_github_repo_languages,
            commands::github::get_github_readme,
            commands::github::list_github_contents,
            commands::github::get_github_file,
            commands::github::update_github_repo,
            commands::github::replace_github_topics,
            commands::github::list_github_branches,
            commands::github::create_github_branch,
            commands::github::delete_github_branch,
            commands::github::list_github_issues,
            commands::github::get_github_issue,
            commands::github::list_github_issue_comments,
            commands::github::create_github_issue,
            commands::github::set_github_issue_state,
            commands::github::create_github_issue_comment,
            commands::github::list_github_pulls,
            commands::github::get_github_pull,
            commands::github::merge_github_pull,
            commands::github::set_github_pull_state,
            commands::settings::get_storage_paths,
            commands::settings::open_storage_location,
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
