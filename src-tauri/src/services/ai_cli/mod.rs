mod stream;

use std::ffi::OsString;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

pub use stream::AiStreamEvent;
use stream::StreamState;

/// 프론트가 취소 응답을 구분하는 데 쓰는 고정 메시지
pub const AI_CHAT_CANCELLED: &str = "AI_CHAT_CANCELLED";

const CHECK_TIMEOUT: Duration = Duration::from_secs(20);
const CHAT_TIMEOUT: Duration = Duration::from_secs(300);
const SHELL_PATH_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_HISTORY_MESSAGES: usize = 20;
const PATH_MARKER: &str = "__EC2GUI_PATH__";

const SYSTEM_PROMPT: &str = "당신은 EC2 서버를 관리하는 데스크톱 앱(EC2 GUI)에 내장된 AI 도우미입니다. \
리눅스 서버 운영, SSH, Docker, 디스크·권한 관리, GitHub Actions 관련 질문에 간결하고 정확하게 답하세요. \
명령어를 제안할 때는 코드 블록으로 보여 주고, 파괴적인 작업은 위험성을 먼저 알려 주세요. \
사용자가 쓴 언어로 답하세요.";

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Codex,
    Claude,
}

impl AiProvider {
    fn binary_name(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Codex => "Codex CLI",
            Self::Claude => "Claude Code",
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliStatus {
    pub path: String,
    pub version: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiChatRole {
    User,
    Assistant,
}

#[derive(Deserialize)]
pub struct AiChatMessage {
    pub role: AiChatRole,
    pub content: String,
}

struct ProcessOutput {
    success: bool,
    stdout: String,
    stderr: String,
}

/// GUI 앱은 셸 PATH를 상속받지 못하므로(macOS Finder 실행 등) 로그인 셸에서 PATH를 읽어 온다.
fn login_shell_path() -> Option<&'static str> {
    static PATH: OnceLock<Option<String>> = OnceLock::new();
    PATH.get_or_init(read_login_shell_path).as_deref()
}

#[cfg(unix)]
fn read_login_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let script = format!("printf '{PATH_MARKER}%s{PATH_MARKER}' \"$PATH\"");
    let mut command = Command::new(shell);
    command.args(["-ilc", &script]);
    let output = run_with_timeout(command, None, SHELL_PATH_TIMEOUT).ok()?;
    let (_, rest) = output.stdout.split_once(PATH_MARKER)?;
    let (path, _) = rest.split_once(PATH_MARKER)?;
    let path = path.trim();
    (!path.is_empty()).then(|| path.to_string())
}

#[cfg(not(unix))]
fn read_login_shell_path() -> Option<String> {
    None
}

fn search_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    let mut push_all = |value: &OsString| {
        for dir in std::env::split_paths(value) {
            if !dirs.contains(&dir) {
                dirs.push(dir);
            }
        }
    };

    if let Some(path) = login_shell_path() {
        push_all(&OsString::from(path));
    }
    if let Some(path) = std::env::var_os("PATH") {
        push_all(&path);
    }

    let mut extras = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ];
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        extras.extend([
            home.join(".local/bin"),
            home.join(".claude/local"),
            home.join(".npm-global/bin"),
            home.join(".bun/bin"),
            home.join(".volta/bin"),
        ]);
    }
    for dir in extras {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

fn child_path_env() -> Option<OsString> {
    std::env::join_paths(search_dirs()).ok()
}

fn binary_candidates(name: &str) -> Vec<String> {
    if cfg!(windows) {
        vec![format!("{name}.cmd"), format!("{name}.exe"), name.to_string()]
    } else {
        vec![name.to_string()]
    }
}

fn resolve_binary(provider: AiProvider, custom_path: Option<&str>) -> Result<PathBuf, String> {
    if let Some(custom) = custom_path.map(str::trim).filter(|value| !value.is_empty()) {
        let path = PathBuf::from(custom);
        return if path.is_file() {
            Ok(path)
        } else {
            Err(format!("지정한 실행 파일을 찾을 수 없습니다: {custom}"))
        };
    }

    let candidates = binary_candidates(provider.binary_name());
    search_dirs()
        .iter()
        .flat_map(|dir| candidates.iter().map(move |name| dir.join(name)))
        .find(|path| path.is_file())
        .ok_or_else(|| {
            format!(
                "{} 실행 파일({})을 찾지 못했습니다. 설치 후 다시 시도하거나 실행 파일 경로를 직접 입력해 주세요.",
                provider.label(),
                provider.binary_name()
            )
        })
}

fn base_command(binary: &Path) -> Command {
    let mut command = Command::new(binary);
    if let Some(path) = child_path_env() {
        command.env("PATH", path);
    }
    command.env("NO_COLOR", "1");
    command
}

fn spawn_reader<R: Read + Send + 'static>(mut reader: R) -> thread::JoinHandle<String> {
    thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = reader.read_to_end(&mut buffer);
        String::from_utf8_lossy(&buffer).into_owned()
    })
}

fn run_with_timeout(
    mut command: Command,
    stdin: Option<&str>,
    timeout: Duration,
) -> Result<ProcessOutput, String> {
    command
        .stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("프로세스를 실행하지 못했습니다: {error}"))?;

    let stdout = child.stdout.take().map(spawn_reader);
    let stderr = child.stderr.take().map(spawn_reader);

    if let (Some(input), Some(mut pipe)) = (stdin, child.stdin.take()) {
        if let Err(error) = pipe.write_all(input.as_bytes()) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("입력 전달 실패: {error}"));
        }
    }

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "응답 시간이 초과되었습니다 ({}초).",
                    timeout.as_secs()
                ));
            }
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => return Err(format!("프로세스 상태 확인 실패: {error}")),
        }
    };

    Ok(ProcessOutput {
        success: status.success(),
        stdout: stdout.and_then(|handle| handle.join().ok()).unwrap_or_default(),
        stderr: stderr.and_then(|handle| handle.join().ok()).unwrap_or_default(),
    })
}

fn tail(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    let count = trimmed.chars().count();
    if count <= max_chars {
        return trimmed.to_string();
    }
    let skipped: String = trimmed.chars().skip(count - max_chars).collect();
    format!("…{skipped}")
}

fn failure_message(provider: AiProvider, output: &ProcessOutput) -> String {
    let detail = if output.stderr.trim().is_empty() {
        tail(&output.stdout, 800)
    } else {
        tail(&output.stderr, 800)
    };
    if detail.is_empty() {
        format!("{} 실행이 실패했습니다.", provider.label())
    } else {
        format!("{} 실행이 실패했습니다: {detail}", provider.label())
    }
}

pub fn check(provider: AiProvider, custom_path: Option<&str>) -> Result<AiCliStatus, String> {
    let binary = resolve_binary(provider, custom_path)?;
    let mut command = base_command(&binary);
    command.arg("--version");
    let output = run_with_timeout(command, None, CHECK_TIMEOUT)?;
    if !output.success {
        return Err(failure_message(provider, &output));
    }

    let version = output
        .stdout
        .lines()
        .chain(output.stderr.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("알 수 없음")
        .to_string();

    Ok(AiCliStatus {
        path: binary.to_string_lossy().into_owned(),
        version,
    })
}

fn build_prompt(messages: &[AiChatMessage]) -> Result<String, String> {
    let (last, history) = messages
        .split_last()
        .ok_or_else(|| "보낼 메시지가 없습니다.".to_string())?;
    if !matches!(last.role, AiChatRole::User) || last.content.trim().is_empty() {
        return Err("마지막 메시지는 사용자 질문이어야 합니다.".to_string());
    }

    let start = history.len().saturating_sub(MAX_HISTORY_MESSAGES);
    let mut prompt = String::from(SYSTEM_PROMPT);
    if start < history.len() {
        prompt.push_str("\n\n[이전 대화]\n");
        for message in &history[start..] {
            let speaker = match message.role {
                AiChatRole::User => "사용자",
                AiChatRole::Assistant => "AI",
            };
            prompt.push_str(&format!("{speaker}: {}\n\n", message.content.trim()));
        }
    }
    prompt.push_str("\n[새 질문]\n");
    prompt.push_str(last.content.trim());
    Ok(prompt)
}

static ACTIVE_CANCEL: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

/// 진행 중인 대화 요청 하나를 등록하고, drop 시 해제한다.
struct ActiveRequest(Arc<AtomicBool>);

impl ActiveRequest {
    fn register() -> Self {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut guard) = ACTIVE_CANCEL.lock() {
            if let Some(previous) = guard.replace(flag.clone()) {
                previous.store(true, Ordering::SeqCst);
            }
        }
        Self(flag)
    }

    fn cancelled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

impl Drop for ActiveRequest {
    fn drop(&mut self) {
        if let Ok(mut guard) = ACTIVE_CANCEL.lock() {
            if guard.as_ref().is_some_and(|flag| Arc::ptr_eq(flag, &self.0)) {
                guard.take();
            }
        }
    }
}

pub fn cancel_active_chat() {
    if let Ok(guard) = ACTIVE_CANCEL.lock() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

struct StreamOutcome {
    success: bool,
    stderr: String,
}

/// stdout을 줄 단위로 읽어 `on_line`에 넘긴다. 취소·시간 초과 시 프로세스를 종료한다.
fn run_streaming(
    mut command: Command,
    stdin: &str,
    request: &ActiveRequest,
    mut on_line: impl FnMut(&str),
) -> Result<StreamOutcome, String> {
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("프로세스를 실행하지 못했습니다: {error}"))?;

    let stderr = child.stderr.take().map(spawn_reader);
    let (line_tx, line_rx) = mpsc::channel::<String>();
    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else { break };
                if line_tx.send(line).is_err() {
                    break;
                }
            }
        });
    }

    if let Some(mut pipe) = child.stdin.take() {
        if let Err(error) = pipe.write_all(stdin.as_bytes()) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("입력 전달 실패: {error}"));
        }
    }

    let started = Instant::now();
    loop {
        if request.cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(AI_CHAT_CANCELLED.to_string());
        }
        if started.elapsed() >= CHAT_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "응답 시간이 초과되었습니다 ({}초).",
                CHAT_TIMEOUT.as_secs()
            ));
        }
        match line_rx.recv_timeout(Duration::from_millis(100)) {
            Ok(line) => on_line(&line),
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // 자식이 띄운 하위 프로세스가 stdout을 쥐고 있으면 Disconnected가 오지 않는다.
                if matches!(child.try_wait(), Ok(Some(_))) {
                    while let Ok(line) = line_rx.recv_timeout(Duration::from_millis(300)) {
                        on_line(&line);
                    }
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("프로세스 종료 대기 실패: {error}"))?;
    Ok(StreamOutcome {
        success: status.success(),
        stderr: stderr.and_then(|handle| handle.join().ok()).unwrap_or_default(),
    })
}

pub fn chat(
    provider: AiProvider,
    custom_path: Option<&str>,
    workdir: &Path,
    messages: &[AiChatMessage],
    emit: &dyn Fn(AiStreamEvent),
) -> Result<String, String> {
    let request = ActiveRequest::register();
    let binary = resolve_binary(provider, custom_path)?;
    let prompt = build_prompt(messages)?;
    fs::create_dir_all(workdir)
        .map_err(|error| format!("AI 작업 폴더를 만들지 못했습니다: {error}"))?;

    let mut command = base_command(&binary);
    command.current_dir(workdir);
    match provider {
        AiProvider::Claude => {
            command.args([
                "-p",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
            ]);
        }
        AiProvider::Codex => {
            command.args([
                "exec",
                "--json",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "--color",
                "never",
                "-",
            ]);
        }
    }

    emit(AiStreamEvent::Status {
        text: "생각 중…".to_string(),
    });

    let mut state = StreamState::default();
    let outcome = run_streaming(command, &prompt, &request, |line| match provider {
        AiProvider::Claude => stream::handle_claude_line(line, &mut state, emit),
        AiProvider::Codex => stream::handle_codex_line(line, &mut state, emit),
    })?;

    let reply = state
        .final_text
        .as_deref()
        .unwrap_or(&state.text)
        .trim()
        .to_string();

    if let Some(error) = state.error.filter(|_| reply.is_empty() || !outcome.success) {
        return Err(format!("{} 오류: {error}", provider.label()));
    }
    if !outcome.success {
        let output = ProcessOutput {
            success: false,
            stdout: state.raw_lines.join("\n"),
            stderr: outcome.stderr,
        };
        return Err(failure_message(provider, &output));
    }
    if reply.is_empty() {
        return Err(format!("{}가 빈 응답을 반환했습니다.", provider.label()));
    }
    Ok(reply)
}
