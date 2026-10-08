use std::path::PathBuf;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::services::ai_cli::{
    self, AiChatMessage, AiCliStatus, AiProvider, AiStreamEvent, RemoteExecutor,
};
use crate::services::{storage_service, SshConnectionManager};

#[tauri::command]
pub async fn check_ai_cli(
    provider: AiProvider,
    binary_path: Option<String>,
) -> Result<AiCliStatus, String> {
    tauri::async_runtime::spawn_blocking(move || ai_cli::check(provider, binary_path.as_deref()))
        .await
        .map_err(|error| format!("AI CLI 확인 작업 실패: {error}"))?
}

#[tauri::command]
pub async fn send_ai_chat(
    app: AppHandle,
    provider: AiProvider,
    binary_path: Option<String>,
    messages: Vec<AiChatMessage>,
    github_repo: Option<String>,
    on_event: Channel<AiStreamEvent>,
) -> Result<String, String> {
    let paths = storage_service::resolve_and_ensure(&app)?;
    let workdir = PathBuf::from(paths.cache).join("ai-workspace");
    tauri::async_runtime::spawn_blocking(move || {
        let emit = |event: AiStreamEvent| {
            let _ = on_event.send(event);
        };
        let manager = app.try_state::<SshConnectionManager>();
        let executor = manager
            .as_ref()
            .map(|manager| manager.inner() as &dyn RemoteExecutor);
        ai_cli::chat(
            provider,
            binary_path.as_deref(),
            &workdir,
            &messages,
            executor,
            github_repo.as_deref(),
            &emit,
        )
    })
    .await
    .map_err(|error| format!("AI 대화 작업 실패: {error}"))?
}

#[tauri::command]
pub fn cancel_ai_chat() {
    ai_cli::cancel_active_chat();
}

#[tauri::command]
pub fn respond_ai_command_approval(id: u64, approved: bool) -> Result<(), String> {
    ai_cli::respond_approval(id, approved)
}
