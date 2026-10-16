mod command_policy;
pub mod conversation;
mod danger_gate;
mod docker_tool;
mod file_tool;
mod github_tool;
mod remote_tool;
mod stream;
mod weekly_report;

use std::cell::RefCell;
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

pub use conversation::{AiChatRole, AiStoredMessage};
pub use danger_gate::{respond_approval, respond_sudo_password};
pub use file_tool::ExplorerContext;
pub use remote_tool::{RemoteExecutor, RemoteTarget};
pub use stream::AiStreamEvent;
pub use weekly_report::{generate as generate_weekly_report, ReportPeriod};
use danger_gate::{ApprovalCommand, PendingApproval, PendingSudoPassword};
use remote_tool::{CommandOutcome, TOOL_FENCE};
use stream::StreamState;

/// 프론트가 취소 응답을 구분하는 데 쓰는 고정 메시지
pub const AI_CHAT_CANCELLED: &str = "AI_CHAT_CANCELLED";

const CHECK_TIMEOUT: Duration = Duration::from_secs(20);
const CHAT_TIMEOUT: Duration = Duration::from_secs(300);
const SHELL_PATH_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_HISTORY_MESSAGES: usize = 20;
/// 대화 기록에 남기는 도구 결과 요약 길이
const TOOL_CONTEXT_MAX_CHARS: usize = 2000;
/// 명령 요청 → 실행 → 분석을 반복하는 최대 횟수 (마지막 라운드는 답변만)
const MAX_TOOL_ROUNDS: usize = 4;
const LAST_ROUND_NOTE: &str =
    "\n\n[안내] 더 이상 도구를 실행할 수 없습니다. 지금까지의 결과만으로 답하세요.";
const PATH_MARKER: &str = "__EC2GUI_PATH__";

const SYSTEM_PROMPT: &str = "당신은 EC2 서버·Docker·원격 파일·GitHub를 관리하는 데스크톱 앱(OpsDeck)에 내장된 AI 도우미입니다.
답하기 전에 사용자의 질문이 어떤 분야인지 스스로 판단하고(예: 리눅스/서버 운영, 네트워크·보안, Docker·배포, Git/GitHub·CI, 프론트엔드·백엔드 코드, 데이터베이스, 아키텍처 설계), 그 분야의 숙련된 전문가 관점으로 답하세요.
- 질문의 깊이에 맞춰 답의 길이를 정하세요. 단순한 질문은 짧게, 설계·원인 분석 질문은 근거와 대안을 함께 제시하세요.
- 불확실한 내용은 추측임을 밝히고, 확인할 방법을 함께 제시하세요.
- 명령어나 코드는 코드 블록으로 보여 주고, 파괴적인 작업은 위험성을 먼저 알려 주세요.
- 사용자가 쓴 언어로 답하세요.";

/// 프론트 route id 접두사 → (화면 이름, 우선할 전문 분야)
const PAGE_CONTEXTS: [(&str, &str, &str); 5] = [
    ("dashboard", "대시보드", "서버 리소스·디스크·성능 진단"),
    ("file-explorer", "파일 탐색기", "리눅스 파일 시스템·설정 파일·권한"),
    ("docker", "Docker", "컨테이너·이미지·네트워크·볼륨 운영과 배포"),
    ("github", "GitHub", "Git 워크플로·PR 리뷰·GitHub Actions CI/CD"),
    ("settings", "설정", "OpsDeck 앱 설정"),
];

fn page_context(active_page: Option<&str>) -> Option<&'static (&'static str, &'static str, &'static str)> {
    active_page.and_then(|page| {
        PAGE_CONTEXTS
            .iter()
            .find(|(prefix, _, _)| page.starts_with(prefix))
    })
}

fn page_section(active_page: Option<&str>) -> String {
    let Some((_, name, expertise)) = page_context(active_page) else {
        return String::new();
    };
    format!(
        "\n\n[현재 화면]\n사용자는 지금 OpsDeck의 {name} 화면을 보고 있습니다. \
질문이 이 화면과 관련 있어 보이면 {expertise} 전문가 관점을 우선하고, 관련 없으면 질문 내용을 기준으로 분야를 판단하세요."
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
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

/// 프롬프트를 만드는 데 필요한 현재 앱 상황
struct PromptContext<'a> {
    target: Option<&'a RemoteTarget>,
    docker_status: Option<&'a docker_tool::DockerStatus>,
    explorer: Option<&'a ExplorerContext>,
    github_repo: Option<&'a str>,
    active_page: Option<&'a str>,
}

impl PromptContext<'_> {
    /// 세션에 이미 보낸 지침이 지금도 맞는지 판단하는 기준
    fn fingerprint(&self) -> String {
        let target = self
            .target
            .map(|target| format!("{}@{}", target.username, target.host))
            .unwrap_or_else(|| "-".to_string());
        format!("ssh={target}|repo={}", self.github_repo.unwrap_or("-"))
    }

    /// 시스템 프롬프트와 모든 도구 지침
    fn instructions(&self) -> String {
        let mut out = String::from(SYSTEM_PROMPT);
        out.push_str(&page_section(self.active_page));
        out.push_str(danger_gate::AI_DANGER_POLICY);
        if let Some(target) = self.target {
            out.push_str(&remote_tool::tool_instructions(target));
            out.push_str(&docker_tool::instructions(self.docker_status));
            out.push_str(&file_tool::instructions(self.explorer));
        }
        out.push_str(&github_tool::instructions(self.github_repo));
        out
    }

    /// 이어지는 세션에 매 질문마다 붙이는, 바뀔 수 있는 상황 요약
    fn situation(&self) -> String {
        let mut out = String::from("[현재 상황]\n");
        let page = page_context(self.active_page).map_or("알 수 없음", |(_, name, _)| name);
        out.push_str(&format!("- 보고 있는 화면: {page}\n"));
        match self.target {
            Some(target) => out.push_str(&format!(
                "- SSH 접속: {}@{}\n",
                target.username, target.host
            )),
            None => out.push_str("- SSH 접속: 없음 (서버 조회·파일 도구 사용 불가)\n"),
        }
        out.push_str(&format!(
            "- 선택한 GitHub 저장소: {}\n",
            self.github_repo.unwrap_or("없음")
        ));
        if let Some(explorer) = self.explorer {
            out.push_str(&format!(
                "- 파일 탐색기: 폴더 {}, 선택 {}, 열어 둔 파일 {}\n",
                explorer.current_path,
                explorer.selected_path.as_deref().unwrap_or("없음"),
                explorer.open_file.as_deref().unwrap_or("없음"),
            ));
        }
        if let Some(status) = self.docker_status {
            out.push_str(&format!("- Docker 상태:\n{}\n", status.summary()));
        }
        out
    }
}

fn history_section(history: &[AiStoredMessage]) -> String {
    let start = history.len().saturating_sub(MAX_HISTORY_MESSAGES);
    if start >= history.len() {
        return String::new();
    }
    let mut out = String::from("\n\n[이전 대화]\n");
    for message in &history[start..] {
        let speaker = match message.role {
            AiChatRole::User => "사용자",
            AiChatRole::Assistant => "AI",
        };
        out.push_str(&format!("{speaker}: {}\n", message.content.trim()));
        if let Some(context) = message.tool_context.as_deref() {
            out.push_str(&format!("(이 답변에 사용한 도구 결과)\n{}\n", context.trim()));
        }
        out.push('\n');
    }
    out
}

/// 새 세션의 첫 프롬프트: 지침 → 이전 대화 → 새 질문
fn fresh_prompt(context: &PromptContext, history: &[AiStoredMessage], question: &str) -> String {
    format!(
        "{}{}\n\n[새 질문]\n{question}",
        context.instructions(),
        history_section(history)
    )
}

/// 이어지는 세션의 프롬프트. 지침 기준이 바뀌었으면 지침을 다시 보낸다.
fn resume_prompt(context: &PromptContext, fingerprint_matches: bool, question: &str) -> String {
    if fingerprint_matches {
        format!("{}\n[새 질문]\n{question}", context.situation())
    } else {
        format!(
            "[지침 갱신] 접속 서버 또는 저장소가 바뀌어 지침을 다시 전달합니다. 이전 지침 대신 아래를 따르세요.\n\n{}\n\n[새 질문]\n{question}",
            context.instructions()
        )
    }
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

#[derive(Default, PartialEq)]
enum GateMode {
    /// 응답이 도구 블록으로 시작하는지 아직 모름
    #[default]
    Pending,
    Streaming,
    Suppressed,
}

const TOOL_FENCES: [&str; 3] = [TOOL_FENCE, github_tool::TOOL_FENCE, file_tool::TOOL_FENCE];

/// 도구 블록으로 시작하는 응답은 화면에 흘려보내지 않도록 앞부분 delta를 잠시 모아 둔다.
#[derive(Default)]
struct DeltaGate {
    mode: GateMode,
    buffer: String,
}

impl DeltaGate {
    fn push(&mut self, text: String, emit: &dyn Fn(AiStreamEvent)) {
        match self.mode {
            GateMode::Streaming => emit(AiStreamEvent::Delta { text }),
            GateMode::Suppressed => {}
            GateMode::Pending => {
                self.buffer.push_str(&text);
                let head = self.buffer.trim_start();
                if TOOL_FENCES.iter().any(|fence| head.starts_with(fence)) {
                    self.mode = GateMode::Suppressed;
                    self.buffer.clear();
                    emit(AiStreamEvent::Status {
                        text: "도구 실행 준비 중…".to_string(),
                    });
                } else if !TOOL_FENCES.iter().any(|fence| fence.starts_with(head)) {
                    self.mode = GateMode::Streaming;
                    emit(AiStreamEvent::Delta {
                        text: std::mem::take(&mut self.buffer),
                    });
                }
            }
        }
    }

    fn flush(&mut self, emit: &dyn Fn(AiStreamEvent)) {
        if self.mode == GateMode::Pending && !self.buffer.is_empty() {
            self.mode = GateMode::Streaming;
            emit(AiStreamEvent::Delta {
                text: std::mem::take(&mut self.buffer),
            });
        }
    }
}

/// 이어서 쓸 CLI 세션
pub struct ChatSession<'a> {
    pub id: &'a str,
    pub fingerprint: Option<&'a str>,
}

pub struct ChatRequest<'a> {
    /// 이번 질문 이전의 대화 (세션을 이어가지 못할 때 텍스트로 전달)
    pub history: &'a [AiStoredMessage],
    pub question: &'a str,
    pub session: Option<ChatSession<'a>>,
}

pub struct ChatEnvironment<'a> {
    pub executor: Option<&'a dyn RemoteExecutor>,
    pub github_repo: Option<&'a str>,
    pub explorer: Option<&'a ExplorerContext>,
    pub active_page: Option<&'a str>,
}

pub struct ChatOutcome {
    pub reply: String,
    pub session_id: Option<String>,
    pub fingerprint: String,
    /// 이번 답변을 만들며 실행한 도구 결과 요약
    pub tool_context: Option<String>,
}

pub fn chat(
    provider: AiProvider,
    custom_path: Option<&str>,
    workdir: &Path,
    request: &ChatRequest,
    environment: &ChatEnvironment,
    emit: &dyn Fn(AiStreamEvent),
) -> Result<ChatOutcome, String> {
    let question = request.question.trim();
    if question.is_empty() {
        return Err("질문을 입력해 주세요.".to_string());
    }
    let active = ActiveRequest::register();
    let binary = resolve_binary(provider, custom_path)?;
    let executor = environment
        .executor
        .and_then(|executor| executor.target().map(|target| (executor, target)));
    let docker_status = executor.as_ref().and_then(|(executor, _)| {
        emit(AiStreamEvent::Status {
            text: "서버 Docker 상태 확인 중…".to_string(),
        });
        docker_tool::probe(*executor)
    });
    fs::create_dir_all(workdir)
        .map_err(|error| format!("AI 작업 폴더를 만들지 못했습니다: {error}"))?;

    let context = PromptContext {
        target: executor.as_ref().map(|(_, target)| target),
        docker_status: docker_status.as_ref(),
        explorer: environment.explorer,
        github_repo: environment.github_repo,
        active_page: environment.active_page,
    };
    let fingerprint = context.fingerprint();
    let mut run = ToolLoop {
        provider,
        binary: &binary,
        workdir,
        request: &active,
        executor: executor.as_ref().map(|(executor, _)| *executor),
        docker_status: docker_status.clone(),
        emit,
        resume_failed: false,
    };

    if let Some(session) = &request.session {
        let matches = session.fingerprint == Some(fingerprint.as_str());
        let prompt = resume_prompt(&context, matches, question);
        match run.run(prompt, Some(session.id), fingerprint.clone()) {
            Err(_) if run.resume_failed => {
                emit(AiStreamEvent::Reset);
                emit(AiStreamEvent::Status {
                    text: "이전 세션을 이어가지 못해 대화 기록으로 다시 시작합니다…".to_string(),
                });
            }
            other => return other,
        }
    }

    let prompt = fresh_prompt(&context, request.history, question);
    run.run(prompt, None, fingerprint)
}

fn record_tool_result(transcript: &mut String, pending: &mut String, text: &str) {
    transcript.push_str(text);
    pending.push_str(text);
}

/// 도구 요청 → 실행 → 결과 전달을 반복하는 한 번의 질문 처리
struct ToolLoop<'a> {
    provider: AiProvider,
    binary: &'a Path,
    workdir: &'a Path,
    request: &'a ActiveRequest,
    executor: Option<&'a dyn RemoteExecutor>,
    docker_status: Option<docker_tool::DockerStatus>,
    emit: &'a dyn Fn(AiStreamEvent),
    /// 기존 세션으로 첫 호출부터 실패함 (새 세션으로 다시 시도해도 됨)
    resume_failed: bool,
}

impl ToolLoop<'_> {
    fn run(
        &mut self,
        opening: String,
        resume: Option<&str>,
        fingerprint: String,
    ) -> Result<ChatOutcome, String> {
        let emit = self.emit;
        let request = self.request;
        let executor = self.executor;
        let cancelled = || request.cancelled();
        let mut approve = |commands: Vec<ApprovalCommand>| -> Result<bool, String> {
            let pending = PendingApproval::register();
            // 프론트는 이후 상태 이벤트가 오면 승인 UI를 닫으므로 상태를 먼저 보낸다.
            emit(AiStreamEvent::Status {
                text: "실행 승인을 기다리는 중…".to_string(),
            });
            emit(AiStreamEvent::ApprovalRequired {
                id: pending.id,
                commands,
            });
            pending.wait(&cancelled)
        };
        let status = |text: String| emit(AiStreamEvent::Status { text });
        let mut ask_password = |path: &str| -> Result<Option<String>, String> {
            let pending = PendingSudoPassword::register();
            emit(AiStreamEvent::Status {
                text: "sudo 비밀번호 입력을 기다리는 중…".to_string(),
            });
            emit(AiStreamEvent::SudoPasswordRequired {
                id: pending.id,
                path: path.to_string(),
            });
            let password = pending.wait(&cancelled)?;
            emit(AiStreamEvent::Status {
                text: "sudo로 파일 저장 중…".to_string(),
            });
            Ok(password)
        };
        let file_changed = |path: &str| {
            emit(AiStreamEvent::FileChanged {
                path: path.to_string(),
            })
        };

        let mut docker_status = self.docker_status.clone();
        let mut session = resume.map(str::to_string);
        // 이번 질문에서 실행한 모든 도구 결과 (세션이 없을 때 매 라운드 다시 보냄)
        let mut transcript = String::new();
        // 직전 CLI 호출 이후 새로 생긴 도구 결과 (세션을 이어갈 때만 보냄)
        let mut pending = String::new();
        for round in 1..=MAX_TOOL_ROUNDS {
            let last_round = round == MAX_TOOL_ROUNDS;
            let mut prompt = if round == 1 {
                opening.clone()
            } else if session.is_some() {
                std::mem::take(&mut pending).trim_start().to_string()
            } else {
                format!("{opening}{transcript}")
            };
            pending.clear();
            if last_round {
                prompt.push_str(LAST_ROUND_NOTE);
            }

            let turn = match run_cli_turn(
                self.provider,
                self.binary,
                self.workdir,
                &prompt,
                session.as_deref(),
                request,
                true,
                emit,
            ) {
                Ok(turn) => turn,
                Err(error) => {
                    self.resume_failed =
                        round == 1 && resume.is_some() && error != AI_CHAT_CANCELLED;
                    return Err(error);
                }
            };
            if turn.session_id.is_some() {
                session = turn.session_id;
            }
            let reply = turn.reply;

            if !last_round {
                if let Some(requests) = file_tool::parse(&reply) {
                    let output = match (requests, executor) {
                        (Err(error), _) => format!("[실행 실패] {error}"),
                        (Ok(_), None) => "[실행 실패] SSH 연결이 없습니다.".to_string(),
                        (Ok(requests), Some(executor)) => file_tool::format_results(&file_tool::run(
                            executor,
                            requests,
                            &cancelled,
                            &mut approve,
                            &mut ask_password,
                            &file_changed,
                        )?),
                    };
                    record_tool_result(&mut transcript, &mut pending, &format!("\n\n[파일 도구 결과 {round}]\n{output}"));
                    status("파일 작업 결과 분석 중…".into());
                    continue;
                }
                if let Some(requests) = github_tool::parse(&reply) {
                    let output = match requests {
                        Ok(requests) => remote_tool::format_results(&github_tool::run(requests, &cancelled, &mut approve, &github_tool::execute)?),
                        Err(error) => format!("[실행 실패] {error}"),
                    };
                    record_tool_result(&mut transcript, &mut pending, &format!("\n\n[GitHub 도구 결과 {round}]\n{output}"));
                    status("GitHub 결과 분석 중…".into());
                    continue;
                }
            }
            let commands = remote_tool::parse_tool_block(&reply).filter(|_| !last_round);
            let Some(commands) = commands else {
                let tool_context = (!transcript.trim().is_empty())
                    .then(|| tail(&transcript, TOOL_CONTEXT_MAX_CHARS));
                return Ok(ChatOutcome {
                    reply,
                    session_id: session,
                    fingerprint,
                    tool_context,
                });
            };

            let Some(executor) = executor else {
                record_tool_result(&mut transcript, &mut pending, "\n[실행 실패] SSH 연결이 없습니다.");
                continue;
            };
            let install_script = || docker_tool::install_script(docker_status.as_ref());
            let results = remote_tool::run_commands(
                executor,
                commands,
                &cancelled,
                &mut approve,
                &install_script,
                &status,
            )?;
            record_tool_result(&mut transcript, &mut pending, &format!(
                "\n\n[서버 명령 실행 결과 {round}]\n{}",
                remote_tool::format_results(&results)
            ));

            let installed = results.iter().any(|result| {
                result.command == docker_tool::INSTALL_COMMAND
                    && matches!(result.outcome, CommandOutcome::Executed(_))
            });
            if installed {
                status("설치 결과 확인 중…".to_string());
                docker_status = docker_tool::probe(executor);
                if let Some(updated) = &docker_status {
                    record_tool_result(&mut transcript, &mut pending, &format!("\n\n[Docker 상태 갱신]\n{}", updated.summary()));
                }
            }
            status("결과 분석 중…".to_string());
        }
        unreachable!("마지막 라운드는 항상 답변을 반환한다")
    }
}

/// CLI 프로세스 한 번 실행. `tools`면 도구 블록 응답을 화면에 흘려보내지 않는다.
fn run_cli_round(
    provider: AiProvider,
    binary: &Path,
    workdir: &Path,
    prompt: &str,
    request: &ActiveRequest,
    tools: bool,
    emit: &dyn Fn(AiStreamEvent),
) -> Result<String, String> {
    run_cli_turn(provider, binary, workdir, prompt, None, request, tools, emit).map(|turn| turn.reply)
}

struct CliTurn {
    reply: String,
    session_id: Option<String>,
}

/// `resume`이 있으면 해당 CLI 세션을 이어서 실행한다.
#[allow(clippy::too_many_arguments)]
fn run_cli_turn(
    provider: AiProvider,
    binary: &Path,
    workdir: &Path,
    prompt: &str,
    resume: Option<&str>,
    request: &ActiveRequest,
    tools: bool,
    emit: &dyn Fn(AiStreamEvent),
) -> Result<CliTurn, String> {
    let mut command = base_command(binary);
    command.current_dir(workdir);
    match (provider, resume) {
        (AiProvider::Claude, _) => {
            command.args([
                "-p",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--disallowedTools",
                danger_gate::CLAUDE_FORBIDDEN_TOOLS,
            ]);
            if let Some(id) = resume {
                command.args(["--resume", id]);
            }
        }
        // `exec resume`은 `--sandbox`를 받지 않으므로 설정 덮어쓰기로 같은 샌드박스를 건다.
        (AiProvider::Codex, Some(id)) => {
            command.args([
                "exec",
                "resume",
                "--json",
                "--skip-git-repo-check",
                "-c",
                &format!("sandbox_mode=\"{}\"", danger_gate::CODEX_SANDBOX),
                id,
                "-",
            ]);
        }
        (AiProvider::Codex, None) => {
            command.args([
                "exec",
                "--json",
                "--skip-git-repo-check",
                "--sandbox",
                danger_gate::CODEX_SANDBOX,
                "--color",
                "never",
                "-",
            ]);
        }
    }

    emit(AiStreamEvent::Status {
        text: "생각 중…".to_string(),
    });

    let gate = RefCell::new(DeltaGate::default());
    let gated = |event: AiStreamEvent| match event {
        AiStreamEvent::Delta { text } if tools => gate.borrow_mut().push(text, emit),
        other => emit(other),
    };

    let mut state = StreamState::default();
    let outcome = run_streaming(command, prompt, request, |line| match provider {
        AiProvider::Claude => stream::handle_claude_line(line, &mut state, &gated),
        AiProvider::Codex => stream::handle_codex_line(line, &mut state, &gated),
    })?;

    let reply = state
        .final_text
        .as_deref()
        .unwrap_or(&state.text)
        .trim()
        .to_string();

    if tools {
        let mut gate = gate.borrow_mut();
        if remote_tool::parse_tool_block(&reply).is_some()
            || github_tool::parse(&reply).is_some()
            || file_tool::parse(&reply).is_some()
        {
            if gate.mode == GateMode::Streaming {
                emit(AiStreamEvent::Reset);
            }
        } else {
            gate.flush(emit);
        }
    }

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
    Ok(CliTurn {
        reply,
        session_id: state.session_id,
    })
}
