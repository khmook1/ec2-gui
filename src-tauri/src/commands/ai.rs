use std::path::PathBuf;

use tauri::ipc::Channel;
use tauri::AppHandle;

use crate::services::ai_cli::{self, AiChatMessage, AiCliStatus, AiProvider, AiStreamEvent};
use crate::services::storage_service;

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
    on_event: Channel<AiStreamEvent>,
) -> Result<String, String> {
    let paths = storage_service::resolve_and_ensure(&app)?;
    let workdir = PathBuf::from(paths.cache).join("ai-workspace");
    tauri::async_runtime::spawn_blocking(move || {
        let emit = |event: AiStreamEvent| {
            let _ = on_event.send(event);
        };
        ai_cli::chat(provider, binary_path.as_deref(), &workdir, &messages, &emit)
    })
    .await
    .map_err(|error| format!("AI 대화 작업 실패: {error}"))?
}

#[tauri::command]
pub fn cancel_ai_chat() {
    ai_cli::cancel_active_chat();
}
