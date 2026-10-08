//! AI가 ` ```ec2gui-ssh ` 블록으로 요청한 명령을 현재 SSH 계정으로 실행하는 도구.

use std::time::Duration;

use super::danger_gate::{self, ApprovalCommand};
use super::docker_tool::{self, INSTALL_COMMAND};
use super::AI_CHAT_CANCELLED;
use crate::services::remote_fs::RemoteCommandOutput;

pub const TOOL_FENCE: &str = "```ec2gui-ssh";
pub const MAX_COMMANDS_PER_ROUND: usize = 5;
pub const COMMAND_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_RESULT_CHARS: usize = 8000;
const RESULT_TAIL_CHARS: usize = 2000;

const PERMISSION_PATTERNS: &[&str] = &[
    "permission denied",
    "operation not permitted",
    "a password is required",
    "a terminal is required",
    "not in the sudoers",
    "is not allowed to execute",
    "must be root",
    "must be run as root",
    "requires root",
    "only root can",
    "are you root",
    "access denied",
    "got permission denied while trying to connect to the docker daemon",
];

pub struct RemoteTarget {
    pub host: String,
    pub username: String,
}

/// SSH 구현과 분리하기 위한 실행기. `SshConnectionManager`가 구현한다.
pub trait RemoteExecutor: Sync {
    fn target(&self) -> Option<RemoteTarget>;
    fn exec_with_timeout(
        &self,
        command: &str,
        timeout: Duration,
    ) -> Result<RemoteCommandOutput, String>;

    fn exec(&self, command: &str) -> Result<RemoteCommandOutput, String> {
        self.exec_with_timeout(command, COMMAND_TIMEOUT)
    }
}

pub fn tool_instructions(target: &RemoteTarget) -> String {
    let RemoteTarget { host, username } = target;
    format!(
        "\n\n[서버 조회 도구]\n\
사용자는 지금 SSH로 `{username}@{host}`에 접속해 있습니다. 서버의 실제 상태가 필요하면 추측하지 말고 \
다른 말 없이 아래 형식의 블록 하나만 출력하세요. 앱이 `{username}` 계정 권한으로 실행한 뒤 결과를 돌려줍니다.\n\
{TOOL_FENCE}\n명령1\n명령2\n```\n\
규칙:\n\
- 한 줄에 명령 하나, 최대 {MAX_COMMANDS_PER_ROUND}개. 각 명령은 20초 안에 끝나야 합니다.\n\
- sudo는 반드시 `sudo -n` 형태로만 쓰세요. 비밀번호를 입력할 수 없습니다.\n\
- `tail -f`, `top`(대신 `top -bn1`), `watch`, 편집기처럼 대화형이거나 끝나지 않는 명령은 쓰지 마세요. `journalctl`은 `--no-pager -n 숫자`를 붙이세요.\n\
- 정보 조회가 목적이면 조회 명령만 쓰세요. 삭제·상태 변경 명령과 비밀정보(환경 변수, .env, 키·인증 파일)를 출력하는 명령은 [위험 작업 정책]에 따라 사람의 승인 없이는 절대 실행되지 않습니다.\n\
- 결과에 [사용자 거부]가 있으면 같은 명령을 다시 요청하지 말고, 거부되어 실행하지 않았다고 알려 주세요.\n\
- 이 컴퓨터(로컬)의 셸이나 파일 도구는 쓰지 마세요. 서버 정보는 이 블록으로만 얻을 수 있습니다.\n\
- 실행 결과에 [권한 없음]이 있으면 \"현재 계정({username})에는 ... 권한이 없습니다\"라고 어떤 작업에 권한이 없는지 분명히 알려 주세요. \
일부 출력이 있으면 얻은 정보는 분석하되 권한 제한도 함께 알려 주세요.\n\
- 결과를 받으면 원본을 그대로 옮기지 말고 핵심을 분석·요약해 답하세요."
    )
}

/// 응답에서 첫 번째 도구 블록의 명령 목록을 꺼낸다.
pub fn parse_tool_block(text: &str) -> Option<Vec<String>> {
    let start = text.find(TOOL_FENCE)? + TOOL_FENCE.len();
    let body = &text[start..];
    let body = body.split_once('\n').map(|(_, rest)| rest).unwrap_or("");
    let end = body.find("```").unwrap_or(body.len());
    let commands: Vec<String> = body[..end]
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| line.strip_prefix("$ ").unwrap_or(line).to_string())
        .collect();
    (!commands.is_empty()).then_some(commands)
}

pub fn is_permission_denied(output: &RemoteCommandOutput) -> bool {
    if output.exit_code == Some(0) {
        return false;
    }
    let lower = output.output.to_ascii_lowercase();
    PERMISSION_PATTERNS
        .iter()
        .any(|pattern| lower.contains(pattern))
}

pub enum CommandOutcome {
    Executed(RemoteCommandOutput),
    Rejected,
    Failed(String),
    Skipped,
}

pub struct CommandResult {
    pub command: String,
    pub outcome: CommandOutcome,
}

fn clip(text: &str) -> String {
    let text = text.trim_end();
    let count = text.chars().count();
    if count <= MAX_RESULT_CHARS {
        return text.to_string();
    }
    let head: String = text
        .chars()
        .take(MAX_RESULT_CHARS - RESULT_TAIL_CHARS)
        .collect();
    let tail: String = text.chars().skip(count - RESULT_TAIL_CHARS).collect();
    format!("{head}\n… (중간 {}자 생략) …\n{tail}", count - MAX_RESULT_CHARS)
}

pub fn format_results(results: &[CommandResult]) -> String {
    let mut out = String::new();
    for result in results {
        out.push_str(&format!("$ {}\n", result.command));
        match &result.outcome {
            CommandOutcome::Executed(output) => {
                let mut labels = Vec::new();
                if is_permission_denied(output) {
                    labels.push("[권한 없음]".to_string());
                }
                match output.exit_code {
                    Some(code) => labels.push(format!("[종료 코드 {code}]")),
                    None if output.timed_out => {
                        labels.push("[시간 초과: 제한 시간 안에 받은 출력만 있음]".to_string())
                    }
                    None => {}
                }
                if output.truncated {
                    labels.push("[출력이 너무 길어 앞부분만 받음]".to_string());
                }
                out.push_str(&labels.join(" "));
                let body = clip(&output.output);
                out.push_str("\n```\n");
                out.push_str(if body.is_empty() { "(출력 없음)" } else { &body });
                out.push_str("\n```\n\n");
            }
            CommandOutcome::Rejected => out.push_str("[사용자 거부] 사용자가 실행을 허락하지 않았습니다.\n\n"),
            CommandOutcome::Failed(error) => out.push_str(&format!("[실행 실패] {error}\n\n")),
            CommandOutcome::Skipped => out.push_str(&format!(
                "[건너뜀] 한 번에 최대 {MAX_COMMANDS_PER_ROUND}개까지만 실행합니다.\n\n"
            )),
        }
    }
    out.trim_end().to_string()
}

/// AI가 요청한 명령 하나를 실제 실행 계획으로 바꾼 것
struct PlannedCommand {
    command: String,
    /// 실행할 스크립트, 또는 실행 전에 실패한 이유
    script: Result<String, String>,
    approval: Option<ApprovalCommand>,
}

fn plan_command(
    command: String,
    install_script: &dyn Fn() -> Result<String, String>,
) -> PlannedCommand {
    if command == INSTALL_COMMAND {
        let script = install_script();
        let approval = script
            .as_ref()
            .ok()
            .map(|script| danger_gate::docker_install_approval(script));
        return PlannedCommand {
            command,
            script,
            approval,
        };
    }

    let approval = danger_gate::remote_command_approval(&command);
    PlannedCommand {
        script: Ok(command.clone()),
        command,
        approval,
    }
}

/// 조회 명령은 바로, 그 밖의 명령은 `danger_gate`를 거쳐 사람의 승인을 받은 뒤에만 실행한다.
/// 승인이 거부되거나 시간 초과되면 해당 명령은 실행하지 않는다.
pub fn run_commands(
    executor: &dyn RemoteExecutor,
    commands: Vec<String>,
    cancelled: &dyn Fn() -> bool,
    approve: &mut dyn FnMut(Vec<ApprovalCommand>) -> Result<bool, String>,
    install_script: &dyn Fn() -> Result<String, String>,
    status: &dyn Fn(String),
) -> Result<Vec<CommandResult>, String> {
    let (runnable, skipped) = if commands.len() > MAX_COMMANDS_PER_ROUND {
        let mut commands = commands;
        let skipped = commands.split_off(MAX_COMMANDS_PER_ROUND);
        (commands, skipped)
    } else {
        (commands, Vec::new())
    };

    let planned: Vec<PlannedCommand> = runnable
        .into_iter()
        .map(|command| plan_command(command, install_script))
        .collect();
    let approvals: Vec<ApprovalCommand> = planned
        .iter()
        .filter_map(|plan| plan.approval.clone())
        .collect();
    let decision = danger_gate::require_human_approval(approvals, approve)?;

    let mut results = Vec::with_capacity(planned.len() + skipped.len());
    for plan in planned {
        if cancelled() {
            return Err(AI_CHAT_CANCELLED.to_string());
        }
        let outcome = match &plan.script {
            Err(error) => CommandOutcome::Failed(error.clone()),
            Ok(_) if !decision.permits(plan.approval.is_some()) => CommandOutcome::Rejected,
            Ok(script) => {
                let result = if plan.command == INSTALL_COMMAND {
                    status("Docker 설치 시작 중… (최대 10분)".to_string());
                    docker_tool::run_install(executor, script, cancelled, status)
                } else {
                    status(format!("서버에서 실행 중: {}", plan.command));
                    executor.exec(script)
                };
                match result {
                    Ok(output) => CommandOutcome::Executed(output),
                    Err(error) if error == AI_CHAT_CANCELLED => return Err(error),
                    Err(error) => CommandOutcome::Failed(error),
                }
            }
        };
        results.push(CommandResult {
            command: plan.command,
            outcome,
        });
    }
    results.extend(skipped.into_iter().map(|command| CommandResult {
        command,
        outcome: CommandOutcome::Skipped,
    }));
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::ai_cli::danger_gate::ApprovalRisk;
    use std::sync::Mutex;

    fn output(text: &str, exit_code: Option<i32>) -> RemoteCommandOutput {
        RemoteCommandOutput {
            output: text.to_string(),
            exit_code,
            truncated: false,
            timed_out: false,
        }
    }

    #[test]
    fn parses_commands_from_tool_block() {
        let text = "```ec2gui-ssh\ndf -h\n\n# 주석\n$ free -m\n```";
        assert_eq!(
            parse_tool_block(text),
            Some(vec!["df -h".to_string(), "free -m".to_string()])
        );
        assert_eq!(parse_tool_block("일반 답변입니다"), None);
        assert_eq!(parse_tool_block("```ec2gui-ssh\n```"), None);
    }

    #[test]
    fn detects_permission_denied_only_on_failure() {
        assert!(is_permission_denied(&output(
            "ls: cannot open directory '/root': Permission denied",
            Some(2)
        )));
        assert!(is_permission_denied(&output(
            "sudo: a password is required",
            Some(1)
        )));
        assert!(!is_permission_denied(&output("Permission denied 로그 한 줄", Some(0))));
        assert!(!is_permission_denied(&output("No such file", Some(1))));
    }

    #[test]
    fn formats_labels_for_each_outcome() {
        let text = format_results(&[
            CommandResult {
                command: "cat /root/x".into(),
                outcome: CommandOutcome::Executed(output("Permission denied", Some(1))),
            },
            CommandResult {
                command: "rm -rf /tmp/x".into(),
                outcome: CommandOutcome::Rejected,
            },
        ]);
        assert!(text.contains("$ cat /root/x\n[권한 없음] [종료 코드 1]"));
        assert!(text.contains("$ rm -rf /tmp/x\n[사용자 거부]"));
    }

    #[derive(Default)]
    struct FakeExecutor {
        calls: Mutex<Vec<(String, Duration)>>,
    }

    impl RemoteExecutor for FakeExecutor {
        fn target(&self) -> Option<RemoteTarget> {
            None
        }

        fn exec_with_timeout(
            &self,
            command: &str,
            timeout: Duration,
        ) -> Result<RemoteCommandOutput, String> {
            self.calls
                .lock()
                .unwrap()
                .push((command.to_string(), timeout));
            Ok(output(&format!("ok\n{}0", docker_tool::DONE_MARKER), Some(0)))
        }
    }

    fn run(
        executor: &FakeExecutor,
        commands: &[&str],
        answer: bool,
        install: Result<&str, &str>,
    ) -> (Vec<CommandResult>, Vec<ApprovalCommand>) {
        let mut requested = Vec::new();
        let mut approve = |items: Vec<ApprovalCommand>| {
            requested.extend(items);
            Ok(answer)
        };
        let install_script = || install.map(str::to_string).map_err(str::to_string);
        let results = run_commands(
            executor,
            commands.iter().map(|c| c.to_string()).collect(),
            &|| false,
            &mut approve,
            &install_script,
            &|_| {},
        )
        .unwrap();
        (results, requested)
    }

    #[test]
    fn read_only_commands_run_without_approval() {
        let executor = FakeExecutor::default();
        let (results, requested) = run(&executor, &["docker ps -a"], false, Err("unused"));
        assert!(requested.is_empty());
        assert!(matches!(results[0].outcome, CommandOutcome::Executed(_)));
        assert_eq!(executor.calls.lock().unwrap()[0].1, COMMAND_TIMEOUT);
    }

    #[test]
    fn rejected_sensitive_and_mutating_commands_never_run() {
        let executor = FakeExecutor::default();
        let (results, requested) = run(
            &executor,
            &["df -h", "cat /srv/app/.env", "docker rm -f web"],
            false,
            Err("unused"),
        );
        let risks: Vec<ApprovalRisk> = requested.iter().map(|item| item.risk).collect();
        assert_eq!(risks, vec![ApprovalRisk::Sensitive, ApprovalRisk::Destructive]);
        assert!(matches!(results[0].outcome, CommandOutcome::Executed(_)));
        assert!(matches!(results[1].outcome, CommandOutcome::Rejected));
        assert!(matches!(results[2].outcome, CommandOutcome::Rejected));
        let calls = executor.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, "df -h");
    }

    #[test]
    fn install_runs_app_script_after_approval() {
        let executor = FakeExecutor::default();
        let (results, requested) = run(&executor, &[INSTALL_COMMAND], true, Ok("echo install"));
        assert_eq!(requested.len(), 1);
        assert_eq!(requested[0].risk, ApprovalRisk::DockerInstall);
        assert_eq!(requested[0].command, "echo install");
        assert_eq!(results[0].command, INSTALL_COMMAND);
        assert!(matches!(&results[0].outcome, CommandOutcome::Executed(out) if out.exit_code == Some(0)));
        let calls = executor.calls.lock().unwrap();
        assert!(calls[0].0.contains("nohup sh -c"));
        assert!(calls[0].0.contains("echo install"));
        assert!(calls.iter().all(|(_, timeout)| *timeout == COMMAND_TIMEOUT));
    }

    #[test]
    fn install_rejection_or_error_skips_execution() {
        let executor = FakeExecutor::default();
        let (results, _) = run(&executor, &[INSTALL_COMMAND], false, Ok("echo install"));
        assert!(matches!(results[0].outcome, CommandOutcome::Rejected));

        let (results, requested) = run(&executor, &[INSTALL_COMMAND], true, Err("sudo 불가"));
        assert!(requested.is_empty());
        assert!(matches!(&results[0].outcome, CommandOutcome::Failed(error) if error == "sudo 불가"));
        assert!(executor.calls.lock().unwrap().is_empty());
    }
}
