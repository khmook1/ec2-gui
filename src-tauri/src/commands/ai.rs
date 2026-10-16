use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::services::ai_cli::conversation::{self, AiConversation, AiConversationSummary};
use crate::services::ai_cli::{
    self, AiCliStatus, AiProvider, AiStreamEvent, ChatEnvironment, ChatRequest, ChatSession,
    ExplorerContext, RemoteExecutor, AI_CHAT_CANCELLED,
};
use crate::services::{storage_service, SshConnectionManager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatReply {
    pub conversation_id: String,
    pub reply: String,
}

fn conversations_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let paths = storage_service::resolve_and_ensure(app)?;
    let dir = PathBuf::from(paths.app_data).join("ai-conversations");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("대화 폴더를 만들지 못했습니다: {error}"))?;
    Ok(dir)
}

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
#[allow(clippy::too_many_arguments)]
pub async fn send_ai_chat(
    app: AppHandle,
    provider: AiProvider,
    binary_path: Option<String>,
    conversation_id: String,
    question: String,
    github_repo: Option<String>,
    explorer: Option<ExplorerContext>,
    active_page: Option<String>,
    on_event: Channel<AiStreamEvent>,
) -> Result<AiChatReply, String> {
    let paths = storage_service::resolve_and_ensure(&app)?;
    let workdir = PathBuf::from(paths.cache).join("ai-workspace");
    let dir = conversations_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut conversation = conversation::load(&dir, &conversation_id)?
            .unwrap_or_else(|| AiConversation::new(&conversation_id, provider, &question));
        // 다른 CLI의 세션은 이어 쓸 수 없으므로 텍스트 기록으로 전달한다.
        if conversation.provider != provider {
            conversation.provider = provider;
            conversation.session_id = None;
            conversation.context_fingerprint = None;
        }

        // 취소 시 화면에 보인 부분 답변을 기록에 남기기 위해 모아 둔다.
        let partial = Mutex::new(String::new());
        let emit = |event: AiStreamEvent| {
            if let Ok(mut text) = partial.lock() {
                match &event {
                    AiStreamEvent::Delta { text: chunk } => text.push_str(chunk),
                    AiStreamEvent::Reset => text.clear(),
                    _ => {}
                }
            }
            let _ = on_event.send(event);
        };

        let manager = app.try_state::<SshConnectionManager>();
        let environment = ChatEnvironment {
            executor: manager
                .as_ref()
                .map(|manager| manager.inner() as &dyn RemoteExecutor),
            github_repo: github_repo.as_deref(),
            explorer: explorer.as_ref(),
            active_page: active_page.as_deref(),
        };
        let request = ChatRequest {
            history: &conversation.messages,
            question: &question,
            session: conversation.session_id.as_deref().map(|id| ChatSession {
                id,
                fingerprint: conversation.context_fingerprint.as_deref(),
            }),
        };
        let result = ai_cli::chat(
            provider,
            binary_path.as_deref(),
            &workdir,
            &request,
            &environment,
            &emit,
        );

        match result {
            Ok(outcome) => {
                conversation.push_turn(&question, &outcome.reply, outcome.tool_context);
                if outcome.session_id.is_some() {
                    conversation.session_id = outcome.session_id;
                    conversation.context_fingerprint = Some(outcome.fingerprint);
                }
                conversation::save(&dir, &conversation)?;
                Ok(AiChatReply {
                    conversation_id: conversation.id,
                    reply: outcome.reply,
                })
            }
            Err(error) => {
                let partial = partial.into_inner().unwrap_or_default();
                if error == AI_CHAT_CANCELLED && !partial.trim().is_empty() {
                    conversation.push_turn(&question, &partial, None);
                    conversation::save(&dir, &conversation)?;
                }
                Err(error)
            }
        }
    })
    .await
    .map_err(|error| format!("AI 대화 작업 실패: {error}"))?
}

#[tauri::command]
pub fn list_ai_conversations(app: AppHandle) -> Result<Vec<AiConversationSummary>, String> {
    conversation::list_summaries(&conversations_dir(&app)?)
}

#[tauri::command]
pub fn get_ai_conversation(app: AppHandle, id: String) -> Result<Option<AiConversation>, String> {
    conversation::load(&conversations_dir(&app)?, &id)
}

#[tauri::command]
pub fn delete_ai_conversation(app: AppHandle, id: String) -> Result<(), String> {
    conversation::delete(&conversations_dir(&app)?, &id)
}

#[tauri::command]
pub fn cancel_ai_chat() {
    ai_cli::cancel_active_chat();
}

#[tauri::command]
pub fn respond_ai_command_approval(id: u64, approved: bool) -> Result<(), String> {
    ai_cli::respond_approval(id, approved)
}

#[tauri::command]
pub fn respond_ai_sudo_password(id: u64, password: Option<String>) -> Result<(), String> {
    ai_cli::respond_sudo_password(id, password)
}
