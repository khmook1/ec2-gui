use serde::Serialize;
use serde_json::Value;

use super::danger_gate::ApprovalCommand;

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiStreamEvent {
    /// 응답 본문에 이어 붙일 텍스트 조각
    Delta { text: String },
    /// 진행 상태 안내 (생각 중, 명령 실행 중 등)
    Status { text: String },
    /// 지금까지 받은 응답 본문을 지운다 (본문 중간에 도구 블록이 나온 경우)
    Reset,
    /// 상태 변경·민감·설치 명령 실행 전 사용자 승인 요청
    ApprovalRequired {
        id: u64,
        commands: Vec<ApprovalCommand>,
    },
}

#[derive(Default)]
pub struct StreamState {
    pub text: String,
    pub final_text: Option<String>,
    pub error: Option<String>,
    pub raw_lines: Vec<String>,
    message_has_delta: bool,
}

impl StreamState {
    fn push_text(&mut self, chunk: &str, emit: &dyn Fn(AiStreamEvent)) {
        if chunk.is_empty() {
            return;
        }
        self.text.push_str(chunk);
        emit(AiStreamEvent::Delta {
            text: chunk.to_string(),
        });
    }

    fn push_block(&mut self, block: &str, emit: &dyn Fn(AiStreamEvent)) {
        let block = block.trim();
        if block.is_empty() {
            return;
        }
        if self.text.is_empty() {
            self.push_text(block, emit);
        } else {
            self.push_text(&format!("\n\n{block}"), emit);
        }
    }

    fn status(text: impl Into<String>, emit: &dyn Fn(AiStreamEvent)) {
        emit(AiStreamEvent::Status { text: text.into() });
    }

    fn keep_raw(&mut self, line: &str) {
        if self.raw_lines.len() < 40 {
            self.raw_lines.push(line.to_string());
        }
    }
}

fn parse_line(line: &str, state: &mut StreamState) -> Option<Value> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    match serde_json::from_str::<Value>(trimmed) {
        Ok(value) => Some(value),
        Err(_) => {
            state.keep_raw(trimmed);
            None
        }
    }
}

/// `claude -p --output-format stream-json --verbose --include-partial-messages`
pub fn handle_claude_line(line: &str, state: &mut StreamState, emit: &dyn Fn(AiStreamEvent)) {
    let Some(value) = parse_line(line, state) else {
        return;
    };

    match value["type"].as_str() {
        Some("stream_event") => {
            let event = &value["event"];
            match event["type"].as_str() {
                Some("content_block_start") => {
                    if event["content_block"]["type"] == "tool_use" {
                        let name = event["content_block"]["name"].as_str().unwrap_or("도구");
                        StreamState::status(format!("{name} 사용 중…"), emit);
                    }
                }
                Some("content_block_delta") => {
                    let Some(text) = event["delta"]["text"].as_str() else {
                        return;
                    };
                    if !state.message_has_delta && !state.text.is_empty() {
                        state.push_text("\n\n", emit);
                    }
                    state.message_has_delta = true;
                    state.push_text(text, emit);
                }
                _ => {}
            }
        }
        Some("assistant") => {
            if !state.message_has_delta {
                let text = value["message"]["content"]
                    .as_array()
                    .map(|blocks| {
                        blocks
                            .iter()
                            .filter(|block| block["type"] == "text")
                            .filter_map(|block| block["text"].as_str())
                            .collect::<Vec<_>>()
                            .join("")
                    })
                    .unwrap_or_default();
                state.push_block(&text, emit);
            }
            state.message_has_delta = false;
        }
        Some("result") => {
            let result = value["result"].as_str().map(str::to_string);
            if value["is_error"].as_bool() == Some(true) {
                state.error = Some(result.unwrap_or_else(|| {
                    value["subtype"]
                        .as_str()
                        .unwrap_or("알 수 없는 오류")
                        .to_string()
                }));
                return;
            }
            if let Some(result) = result {
                if state.text.trim().is_empty() {
                    state.push_block(&result, emit);
                }
                state.final_text = Some(result);
            }
        }
        _ => {}
    }
}

/// `codex exec --json` — 에이전트 메시지는 완성된 단위(`item.completed`)로만 온다.
pub fn handle_codex_line(line: &str, state: &mut StreamState, emit: &dyn Fn(AiStreamEvent)) {
    let Some(value) = parse_line(line, state) else {
        return;
    };
    let item = &value["item"];

    match value["type"].as_str() {
        Some("item.started") => match item["type"].as_str() {
            Some("command_execution") => {
                let command = item["command"].as_str().unwrap_or("");
                StreamState::status(format!("명령 실행 중: {command}"), emit);
            }
            Some("reasoning") => StreamState::status("생각 중…", emit),
            Some("web_search") => StreamState::status("웹 검색 중…", emit),
            Some("mcp_tool_call") => StreamState::status("도구 호출 중…", emit),
            Some("file_change") => StreamState::status("파일 변경 검토 중…", emit),
            _ => {}
        },
        Some("item.completed") => {
            if item["type"] == "agent_message" {
                if let Some(text) = item["text"].as_str() {
                    state.push_block(text, emit);
                }
            }
        }
        Some("turn.failed") => {
            state.error =
                item_error(&value["error"]).or_else(|| Some("응답 생성에 실패했습니다.".into()));
        }
        Some("error") => {
            state.error = value["message"].as_str().map(str::to_string);
        }
        _ => {}
    }
}

fn item_error(value: &Value) -> Option<String> {
    value["message"]
        .as_str()
        .or_else(|| value.as_str())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    fn collect(
        lines: &[&str],
        handler: fn(&str, &mut StreamState, &dyn Fn(AiStreamEvent)),
    ) -> (StreamState, Vec<String>) {
        let deltas = RefCell::new(Vec::new());
        let emit = |event: AiStreamEvent| {
            if let AiStreamEvent::Delta { text } = event {
                deltas.borrow_mut().push(text);
            }
        };
        let mut state = StreamState::default();
        for line in lines {
            handler(line, &mut state, &emit);
        }
        (state, deltas.into_inner())
    }

    #[test]
    fn codex_agent_messages_become_deltas() {
        let (state, deltas) = collect(
            &[
                r#"{"type":"thread.started","thread_id":"t"}"#,
                r#"{"type":"turn.started"}"#,
                r#"{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"첫 번째"}}"#,
                r#"{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"두 번째"}}"#,
                r#"{"type":"turn.completed","usage":{}}"#,
            ],
            handle_codex_line,
        );
        assert_eq!(deltas, vec!["첫 번째", "\n\n두 번째"]);
        assert_eq!(state.text, "첫 번째\n\n두 번째");
        assert!(state.error.is_none());
    }

    #[test]
    fn claude_partial_deltas_skip_duplicate_assistant_message() {
        let (state, deltas) = collect(
            &[
                r#"{"type":"system","subtype":"init"}"#,
                r#"{"type":"stream_event","event":{"type":"message_start"}}"#,
                r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"안녕"}}}"#,
                r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"하세요"}}}"#,
                r#"{"type":"assistant","message":{"content":[{"type":"text","text":"안녕하세요"}]}}"#,
                r#"{"type":"result","subtype":"success","is_error":false,"result":"안녕하세요"}"#,
            ],
            handle_claude_line,
        );
        assert_eq!(deltas, vec!["안녕", "하세요"]);
        assert_eq!(state.final_text.as_deref(), Some("안녕하세요"));
    }

    #[test]
    fn claude_without_partials_uses_assistant_message() {
        let (state, deltas) = collect(
            &[
                r#"{"type":"assistant","message":{"content":[{"type":"text","text":"답변"}]}}"#,
                r#"{"type":"result","subtype":"error_max_turns","is_error":true}"#,
            ],
            handle_claude_line,
        );
        assert_eq!(deltas, vec!["답변"]);
        assert_eq!(state.error.as_deref(), Some("error_max_turns"));
    }
}
