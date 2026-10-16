use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use serde::{Deserialize, Serialize};

use super::AiProvider;

const TITLE_MAX_CHARS: usize = 40;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AiChatRole {
    User,
    Assistant,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStoredMessage {
    pub role: AiChatRole,
    pub content: String,
    /// 이 답변을 만들 때 실행한 도구 결과 요약 (텍스트 히스토리로 대체할 때 함께 전달)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_context: Option<String>,
    pub created_at: String,
}

impl AiStoredMessage {
    pub fn new(role: AiChatRole, content: impl Into<String>, tool_context: Option<String>) -> Self {
        Self {
            role,
            content: content.into(),
            tool_context,
            created_at: Local::now().to_rfc3339(),
        }
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConversation {
    pub id: String,
    pub title: String,
    pub provider: AiProvider,
    /// CLI 세션 ID. `provider`와 같은 CLI에서만 이어서 쓸 수 있다.
    #[serde(default)]
    pub session_id: Option<String>,
    /// 세션에 전달한 지침의 기준(접속 서버·저장소). 바뀌면 지침을 다시 보낸다.
    #[serde(default)]
    pub context_fingerprint: Option<String>,
    pub messages: Vec<AiStoredMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConversationSummary {
    pub id: String,
    pub title: String,
    pub provider: AiProvider,
    pub message_count: usize,
    pub created_at: String,
    pub updated_at: String,
}

impl AiConversation {
    pub fn new(id: &str, provider: AiProvider, first_question: &str) -> Self {
        let now = Local::now().to_rfc3339();
        Self {
            id: id.to_string(),
            title: make_title(first_question),
            provider,
            session_id: None,
            context_fingerprint: None,
            messages: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn summary(&self) -> AiConversationSummary {
        AiConversationSummary {
            id: self.id.clone(),
            title: self.title.clone(),
            provider: self.provider,
            message_count: self.messages.len(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }

    pub fn push_turn(&mut self, question: &str, answer: &str, tool_context: Option<String>) {
        self.messages
            .push(AiStoredMessage::new(AiChatRole::User, question.trim(), None));
        self.messages
            .push(AiStoredMessage::new(AiChatRole::Assistant, answer.trim(), tool_context));
        self.updated_at = Local::now().to_rfc3339();
    }
}

fn make_title(question: &str) -> String {
    let line = question.lines().map(str::trim).find(|line| !line.is_empty()).unwrap_or("새 대화");
    if line.chars().count() <= TITLE_MAX_CHARS {
        return line.to_string();
    }
    let cut: String = line.chars().take(TITLE_MAX_CHARS).collect();
    format!("{cut}…")
}

/// 프론트가 만든 ID를 파일 이름으로 쓰므로 경로 문자를 막는다.
fn validate_id(id: &str) -> Result<(), String> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_');
    if valid {
        Ok(())
    } else {
        Err(format!("잘못된 대화 ID입니다: {id}"))
    }
}

fn file_path(dir: &Path, id: &str) -> Result<PathBuf, String> {
    validate_id(id)?;
    Ok(dir.join(format!("{id}.json")))
}

pub fn load(dir: &Path, id: &str) -> Result<Option<AiConversation>, String> {
    let path = file_path(dir, id)?;
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|error| format!("대화를 읽지 못했습니다: {error}"))?;
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|error| format!("대화 파일 형식이 올바르지 않습니다: {error}"))
}

pub fn save(dir: &Path, conversation: &AiConversation) -> Result<(), String> {
    let path = file_path(dir, &conversation.id)?;
    let raw = serde_json::to_string_pretty(conversation)
        .map_err(|error| format!("대화를 직렬화하지 못했습니다: {error}"))?;
    fs::write(path, raw).map_err(|error| format!("대화를 저장하지 못했습니다: {error}"))
}

pub fn delete(dir: &Path, id: &str) -> Result<(), String> {
    let path = file_path(dir, id)?;
    if path.is_file() {
        fs::remove_file(path).map_err(|error| format!("대화를 삭제하지 못했습니다: {error}"))?;
    }
    Ok(())
}

pub fn list_summaries(dir: &Path) -> Result<Vec<AiConversationSummary>, String> {
    let entries =
        fs::read_dir(dir).map_err(|error| format!("대화 목록을 읽지 못했습니다: {error}"))?;
    let mut summaries: Vec<AiConversationSummary> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .filter_map(|path| fs::read_to_string(path).ok())
        .filter_map(|raw| serde_json::from_str::<AiConversation>(&raw).ok())
        .map(|conversation| conversation.summary())
        .collect();
    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(summaries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_like_ids() {
        assert!(validate_id("2f1c-ab_9").is_ok());
        assert!(validate_id("../etc").is_err());
        assert!(validate_id("a/b").is_err());
        assert!(validate_id("").is_err());
    }

    #[test]
    fn title_uses_first_line_and_truncates() {
        assert_eq!(make_title("\n  디스크 확인\n자세히"), "디스크 확인");
        let long = "가".repeat(50);
        assert_eq!(make_title(&long).chars().count(), TITLE_MAX_CHARS + 1);
    }
}
