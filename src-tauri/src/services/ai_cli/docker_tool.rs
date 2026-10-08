//! 접속 서버의 Docker 상태 점검, AI용 Docker 규칙, `@install-docker` 설치 스크립트.

use std::thread;
use std::time::{Duration, Instant};

use super::remote_tool::{RemoteExecutor, TOOL_FENCE};
use super::AI_CHAT_CANCELLED;
use crate::services::remote_fs::{shell_quote, RemoteCommandOutput};

/// AI가 설치를 요청할 때 도구 블록에 쓰는 가상 명령. 실제 스크립트는 앱이 만든다.
pub const INSTALL_COMMAND: &str = "@install-docker";
pub const INSTALL_TIMEOUT: Duration = Duration::from_secs(600);
pub(super) const DONE_MARKER: &str = "__OPSDECK_INSTALL_DONE__";
const INSTALL_LOG: &str = "/tmp/opsdeck-docker-install.log";
const INSTALL_EXIT: &str = "/tmp/opsdeck-docker-install.exit";
const POLL_INTERVAL: Duration = Duration::from_secs(3);
const MAX_POLL_ERRORS: u32 = 5;

const PROBE_SCRIPT: &str = r#"echo "uid=$(id -u)"
if sudo -n true >/dev/null 2>&1; then echo sudo=1; else echo sudo=0; fi
if [ -r /etc/os-release ]; then
  ( . /etc/os-release; echo "os_id=$ID"; echo "os_like=$ID_LIKE"; echo "os_version=$VERSION_ID"; echo "os_codename=${UBUNTU_CODENAME:-$VERSION_CODENAME}"; echo "os_name=$PRETTY_NAME" )
fi
if command -v docker >/dev/null 2>&1; then
  echo installed=1
  echo "client=$(docker version --format '{{.Client.Version}}' 2>/dev/null)"
  server=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
  if [ -n "$server" ]; then
    echo daemon=running; echo "server=$server"
  else
    server=$(sudo -n docker version --format '{{.Server.Version}}' 2>/dev/null)
    if [ -n "$server" ]; then
      echo daemon=sudo; echo "server=$server"
    elif docker info 2>&1 | grep -qi 'permission denied'; then
      echo daemon=permission
    else
      echo daemon=stopped
    fi
  fi
  if docker compose version >/dev/null 2>&1; then echo compose=plugin
  elif command -v docker-compose >/dev/null 2>&1; then echo compose=standalone
  else echo compose=none; fi
else
  echo installed=0
fi"#;

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum DaemonState {
    #[default]
    Unknown,
    Running,
    /// 현재 계정으로는 안 되고 `sudo -n docker`로만 된다
    RunningWithSudo,
    PermissionDenied,
    Stopped,
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum ComposeKind {
    #[default]
    None,
    Plugin,
    Standalone,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct DockerStatus {
    pub installed: bool,
    pub client_version: Option<String>,
    pub server_version: Option<String>,
    pub daemon: DaemonState,
    pub compose: ComposeKind,
    pub os_id: String,
    pub os_like: String,
    pub os_version: String,
    pub os_codename: String,
    pub os_name: String,
    pub is_root: bool,
    pub sudo_nopasswd: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Distro {
    Ubuntu,
    Debian,
    AmazonLinux2023,
    AmazonLinux2,
    Fedora,
    Rhel,
    CentosLike,
    Unknown,
}

pub fn probe(executor: &dyn RemoteExecutor) -> Option<DockerStatus> {
    let output = executor.exec(PROBE_SCRIPT).ok()?;
    Some(parse_probe(&output.output))
}

fn parse_probe(output: &str) -> DockerStatus {
    let mut status = DockerStatus::default();
    for line in output.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim().to_string();
        match key.trim() {
            "uid" => status.is_root = value == "0",
            "sudo" => status.sudo_nopasswd = value == "1",
            "os_id" => status.os_id = value.to_ascii_lowercase(),
            "os_like" => status.os_like = value.to_ascii_lowercase(),
            "os_version" => status.os_version = value,
            "os_codename" => status.os_codename = value,
            "os_name" => status.os_name = value,
            "installed" => status.installed = value == "1",
            "client" => status.client_version = (!value.is_empty()).then_some(value),
            "server" => status.server_version = (!value.is_empty()).then_some(value),
            "daemon" => {
                status.daemon = match value.as_str() {
                    "running" => DaemonState::Running,
                    "sudo" => DaemonState::RunningWithSudo,
                    "permission" => DaemonState::PermissionDenied,
                    "stopped" => DaemonState::Stopped,
                    _ => DaemonState::Unknown,
                }
            }
            "compose" => {
                status.compose = match value.as_str() {
                    "plugin" => ComposeKind::Plugin,
                    "standalone" => ComposeKind::Standalone,
                    _ => ComposeKind::None,
                }
            }
            _ => {}
        }
    }
    status
}

impl DockerStatus {
    fn can_install(&self) -> bool {
        self.is_root || self.sudo_nopasswd
    }

    fn distro(&self) -> Distro {
        let like = |name: &str| self.os_like.split_whitespace().any(|item| item == name);
        match self.os_id.as_str() {
            "ubuntu" => Distro::Ubuntu,
            "debian" => Distro::Debian,
            "amzn" if self.os_version.starts_with("2023") => Distro::AmazonLinux2023,
            "amzn" => Distro::AmazonLinux2,
            "fedora" => Distro::Fedora,
            "rhel" => Distro::Rhel,
            "centos" | "rocky" | "almalinux" | "ol" => Distro::CentosLike,
            _ if like("ubuntu") => Distro::Ubuntu,
            _ if like("debian") => Distro::Debian,
            _ if like("rhel") || like("centos") || like("fedora") => Distro::CentosLike,
            _ => Distro::Unknown,
        }
    }

    fn os_label(&self) -> String {
        if !self.os_name.is_empty() {
            return self.os_name.clone();
        }
        if self.os_id.is_empty() {
            return "알 수 없음".to_string();
        }
        format!("{} {}", self.os_id, self.os_version).trim().to_string()
    }

    pub fn summary(&self) -> String {
        let mut lines = vec![format!("- OS: {}", self.os_label())];
        if self.installed {
            let client = self.client_version.as_deref().unwrap_or("알 수 없음");
            lines.push(format!("- Docker: 설치됨 (클라이언트 {client})"));
            let server = self.server_version.as_deref().unwrap_or("?");
            lines.push(format!(
                "- 데몬: {}",
                match self.daemon {
                    DaemonState::Running => format!("실행 중 (서버 {server})"),
                    DaemonState::RunningWithSudo => {
                        format!("실행 중 (서버 {server}). 현재 계정은 docker 그룹이 아니라 `sudo -n docker`로만 사용 가능")
                    }
                    DaemonState::PermissionDenied => {
                        "현재 계정은 docker 소켓 권한이 없고 `sudo -n`도 쓸 수 없음".to_string()
                    }
                    DaemonState::Stopped => "실행 중이 아님 (또는 응답 없음)".to_string(),
                    DaemonState::Unknown => "확인 실패".to_string(),
                }
            ));
            lines.push(format!(
                "- Compose: {}",
                match self.compose {
                    ComposeKind::Plugin => "`docker compose` 플러그인",
                    ComposeKind::Standalone => "`docker-compose` (구버전 단독 실행 파일)",
                    ComposeKind::None => "없음",
                }
            ));
        } else {
            lines.push("- Docker: 설치되어 있지 않음".to_string());
        }
        lines.push(format!(
            "- 관리자 권한: {}",
            if self.is_root {
                "root 계정"
            } else if self.sudo_nopasswd {
                "비밀번호 없는 sudo 가능"
            } else {
                "비밀번호 없는 sudo 불가"
            }
        ));
        lines.join("\n")
    }

    pub fn install_script(&self) -> Result<String, String> {
        if self.installed {
            return Err("Docker가 이미 설치되어 있어 설치를 건너뜁니다.".to_string());
        }
        if !self.can_install() {
            return Err(
                "현재 계정은 root가 아니고 비밀번호 없는 sudo도 쓸 수 없어 앱이 Docker를 설치할 수 없습니다. 터미널에서 직접 설치해야 합니다."
                    .to_string(),
            );
        }
        let sudo = if self.is_root { "" } else { "sudo -n" };
        let user_group = if self.is_root {
            ""
        } else {
            "$S usermod -aG docker \"$(id -un)\"\n"
        };
        let body = match self.distro() {
            Distro::Ubuntu => apt_install("ubuntu"),
            Distro::Debian => apt_install("debian"),
            Distro::AmazonLinux2023 => "$S dnf install -y docker".to_string(),
            Distro::AmazonLinux2 => {
                "$S amazon-linux-extras install -y docker || $S yum install -y docker".to_string()
            }
            Distro::Fedora => dnf_repo_install("fedora"),
            Distro::Rhel => dnf_repo_install("rhel"),
            Distro::CentosLike => dnf_repo_install("centos"),
            Distro::Unknown => "curl -fsSL https://get.docker.com -o /tmp/get-docker.sh\n$S sh /tmp/get-docker.sh".to_string(),
        };
        Ok(format!(
            "set -e\n\
S=\"{sudo}\"\n\
{body}\n\
if command -v systemctl >/dev/null 2>&1; then $S systemctl enable --now docker; else $S service docker start; fi\n\
{user_group}\
echo \"--- 설치 확인 ---\"\n\
docker --version\n\
$S docker info --format 'Docker 서버 {{{{.ServerVersion}}}}' || true\n\
echo \"docker 그룹 권한은 SSH에 다시 접속한 뒤부터 적용됩니다.\""
        ))
    }
}

/// 설치 스크립트를 서버에서 백그라운드로 실행하고 끝날 때까지 짧은 조회로 진행 상황을 확인한다.
/// SSH 연결을 오래 붙잡지 않으므로 설치 중에도 다른 기능을 쓸 수 있고, 대기 중 취소할 수 있다.
pub fn run_install(
    executor: &dyn RemoteExecutor,
    script: &str,
    cancelled: &dyn Fn() -> bool,
    status: &dyn Fn(String),
) -> Result<RemoteCommandOutput, String> {
    let job = format!("( {script}\n) > {INSTALL_LOG} 2>&1; echo $? > {INSTALL_EXIT}");
    let launcher = format!(
        "rm -f {INSTALL_EXIT}; nohup sh -c {} >/dev/null 2>&1 </dev/null & echo started",
        shell_quote(&job)
    );
    let launched = executor.exec(&launcher)?;
    if launched.exit_code != Some(0) {
        return Ok(launched);
    }

    let poll = format!(
        "if [ -f {INSTALL_EXIT} ]; then echo \"{DONE_MARKER}$(cat {INSTALL_EXIT})\"; fi; tail -n 1 {INSTALL_LOG} 2>/dev/null"
    );
    let started = Instant::now();
    let mut poll_errors = 0;
    let exit_code = loop {
        match executor.exec(&poll) {
            Ok(output) => {
                poll_errors = 0;
                let done = output
                    .output
                    .lines()
                    .find_map(|line| line.trim().strip_prefix(DONE_MARKER))
                    .map(|code| code.trim().parse::<i32>().unwrap_or(1));
                if let Some(code) = done {
                    break Some(code);
                }
                let last_line: String = output
                    .output
                    .lines()
                    .last()
                    .unwrap_or("")
                    .trim()
                    .chars()
                    .take(80)
                    .collect();
                let elapsed = started.elapsed().as_secs();
                status(if last_line.is_empty() {
                    format!("Docker 설치 중… {elapsed}초 경과")
                } else {
                    format!("Docker 설치 중… {elapsed}초 경과 · {last_line}")
                });
            }
            Err(error) => {
                poll_errors += 1;
                if poll_errors >= MAX_POLL_ERRORS {
                    return Err(format!(
                        "설치 진행 상황을 확인하지 못했습니다 ({error}). 서버에서 설치가 계속 진행 중일 수 있습니다. 로그: {INSTALL_LOG}"
                    ));
                }
            }
        }
        if started.elapsed() >= INSTALL_TIMEOUT {
            break None;
        }
        let wait_started = Instant::now();
        while wait_started.elapsed() < POLL_INTERVAL {
            if cancelled() {
                return Err(AI_CHAT_CANCELLED.to_string());
            }
            thread::sleep(Duration::from_millis(100));
        }
    };

    let log = executor.exec(&format!("tail -n 60 {INSTALL_LOG}"))?;
    let mut output = log.output.trim_end().to_string();
    match exit_code {
        Some(0) => {}
        Some(code) => output.push_str(&format!(
            "\n설치 실패 (종료 코드 {code}). 전체 로그: {INSTALL_LOG}"
        )),
        None => output.push_str(&format!(
            "\n설치가 {}분 안에 끝나지 않았습니다. 서버에서 계속 진행 중일 수 있습니다. 로그: {INSTALL_LOG}",
            INSTALL_TIMEOUT.as_secs() / 60
        )),
    }
    Ok(RemoteCommandOutput {
        output,
        exit_code,
        truncated: false,
        timed_out: exit_code.is_none(),
    })
}

fn apt_install(distro: &str) -> String {
    format!(
        "APT=\"$S env DEBIAN_FRONTEND=noninteractive apt-get\"\n\
$APT update -y\n\
$APT install -y ca-certificates curl\n\
$S install -m 0755 -d /etc/apt/keyrings\n\
$S curl -fsSL https://download.docker.com/linux/{distro}/gpg -o /etc/apt/keyrings/docker.asc\n\
$S chmod a+r /etc/apt/keyrings/docker.asc\n\
CODENAME=$(. /etc/os-release && echo \"${{UBUNTU_CODENAME:-$VERSION_CODENAME}}\")\n\
echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/{distro} $CODENAME stable\" | $S tee /etc/apt/sources.list.d/docker.list >/dev/null\n\
$APT update -y\n\
$APT install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
    )
}

fn dnf_repo_install(repo: &str) -> String {
    format!(
        "if command -v dnf >/dev/null 2>&1; then PM=dnf; $S dnf -y install dnf-plugins-core; else PM=yum; $S yum -y install yum-utils; fi\n\
REPO=https://download.docker.com/linux/{repo}/docker-ce.repo\n\
$S $PM config-manager --add-repo \"$REPO\" || $S $PM config-manager addrepo --from-repofile=\"$REPO\"\n\
$S $PM install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
    )
}

pub fn install_script(status: Option<&DockerStatus>) -> Result<String, String> {
    status
        .ok_or_else(|| "서버의 Docker 상태를 확인하지 못해 설치 스크립트를 만들 수 없습니다.".to_string())?
        .install_script()
}

/// 프롬프트에 붙일 `[Docker 도구]` 섹션
pub fn instructions(status: Option<&DockerStatus>) -> String {
    let mut out = String::from("\n\n[Docker 도구]\n");
    let Some(status) = status else {
        out.push_str(
            "서버의 Docker 상태를 미리 확인하지 못했습니다. Docker 질문이면 먼저 `command -v docker && docker version`으로 확인하세요.\n",
        );
        out.push_str(DATA_RULES);
        out.push_str(ANALYSIS_RULES);
        return out;
    };

    out.push_str("앱이 방금 확인한 접속 서버의 Docker 상태:\n");
    out.push_str(&status.summary());
    out.push('\n');

    if !status.installed {
        out.push_str(&format!(
            "규칙:\n\
- Docker가 설치되어 있지 않습니다. Docker와 관련된 질문(컨테이너, 이미지, 로그, compose 등)에는 답변 첫 문장을 반드시 \"현재 도커는 설치되어 있지 않습니다.\"로 시작하세요.\n\
- 설치 방법을 물으면 명령을 실행하지 말고, 이 서버 OS({os})에 맞는 설치 절차를 단계별로 자세히 설명하세요. \
사전 패키지 설치, 공식 저장소와 GPG 키 등록, 패키지 설치, `sudo systemctl enable --now docker`, `sudo usermod -aG docker $USER` 후 재접속, \
`docker run --rm hello-world`로 확인까지 포함하고 각 단계는 코드 블록으로 보여 주세요.\n",
            os = status.os_label()
        ));
        if status.can_install() {
            out.push_str(&format!(
                "- 사용자가 설치를 실행해 달라고 요청하면 다른 말 없이 아래 블록만 출력하세요. \
앱이 이 서버 OS에 맞는 설치 스크립트를 만들어 사용자 승인을 받은 뒤 실행합니다(최대 10분).\n\
{TOOL_FENCE}\n{INSTALL_COMMAND}\n```\n\
- 설치 결과를 받으면 성공 여부, 설치된 버전, 다시 접속해야 docker 그룹 권한이 적용된다는 점을 알려 주세요. 실패하면 로그를 분석해 원인과 해결책을 제시하세요.\n"
            ));
        } else {
            out.push_str(
                "- 이 계정은 root가 아니고 비밀번호 없는 sudo도 쓸 수 없어 앱이 대신 설치할 수 없습니다. \
설치를 요청받으면 그 이유를 알리고, 터미널에서 직접 실행할 설치 명령을 단계별로 안내하세요.\n",
            );
        }
        return out;
    }

    out.push_str(&format!(
        "규칙:\n- Docker는 이미 설치되어 있으니 `{INSTALL_COMMAND}`는 쓰지 마세요.\n"
    ));
    match status.daemon {
        DaemonState::RunningWithSudo => out.push_str(
            "- 현재 계정은 docker 그룹이 아닙니다. 모든 docker 명령 앞에 `sudo -n`을 붙이세요 (예: `sudo -n docker ps -a`).\n",
        ),
        DaemonState::PermissionDenied => out.push_str(
            "- 현재 계정은 docker 소켓 권한이 없고 `sudo -n`도 쓸 수 없습니다. Docker 질문에는 권한이 없다는 점을 먼저 알리고, \
관리자가 `sudo usermod -aG docker <계정>` 후 재접속해야 한다고 안내하세요.\n",
        ),
        DaemonState::Stopped => out.push_str(
            "- Docker 데몬이 실행 중이 아닙니다. 이 점을 먼저 알리고, 필요하면 `sudo -n systemctl start docker`를 제안하세요(사용자 승인 후 실행됨).\n",
        ),
        DaemonState::Running | DaemonState::Unknown => {}
    }
    out.push_str(DATA_RULES);
    out.push_str(ANALYSIS_RULES);
    out
}

const DATA_RULES: &str = "Docker 데이터 수집 (서버 조회 도구 블록으로 실행):\n\
- 컨테이너 목록: `docker ps -a --format '{{json .}}'`\n\
- 리소스 사용량: `docker stats --no-stream --format '{{json .}}'` (`--no-stream` 없이 쓰지 마세요)\n\
- 로그: `docker logs --tail 200 --timestamps <컨테이너>` (에러만 보려면 `docker logs --tail 1000 <컨테이너> 2>&1 | grep -iE 'error|warn|fatal|exception|panic' | tail -n 100`)\n\
- 상태 상세: `docker inspect --format '{{json .State}}' <컨테이너>`, 재시작 횟수 `docker inspect --format '{{.RestartCount}}' <컨테이너>`, \
재시작 정책 `docker inspect --format '{{json .HostConfig.RestartPolicy}}' <컨테이너>`\n\
- 이미지와 디스크: `docker images`, `docker system df -v`\n\
- 네트워크·볼륨·포트: `docker network ls`, `docker volume ls`, `docker port <컨테이너>`\n\
- Compose: `docker compose ls`, `docker compose -p <프로젝트> ps`, `docker compose -p <프로젝트> logs --tail 200`\n\
- 최근 이벤트: `docker events --since 1h --until 0s`\n\
- `docker logs -f`, `docker attach`, `docker exec -it`, `--until` 없는 `docker events`처럼 끝나지 않는 명령은 쓰지 마세요.\n\
- `--format` 없는 `docker inspect`와 `docker compose config`는 환경 변수(비밀번호·토큰)가 노출되어 사용자 승인이 필요합니다. 필요한 필드만 `--format`으로 조회하세요.\n\
- start/stop/restart/rm/prune/pull/run/exec/compose up·down처럼 상태를 바꾸는 명령은 [위험 작업 정책]에 따라 사람의 승인 없이는 실행되지 않습니다. 요청 전에 영향 범위를 먼저 설명하세요.\n";

const ANALYSIS_RULES: &str = "Docker 결과 분석:\n\
- 원본 출력을 그대로 옮기지 말고 핵심만 정리하세요. 필요하면 짧은 표를 쓰세요.\n\
- Exited/Restarting/Dead 컨테이너, 0이 아닌 종료 코드, OOMKilled, 높은 재시작 횟수, unhealthy 헬스체크를 먼저 짚으세요.\n\
- 로그에서는 반복되는 에러 패턴, 처음 발생한 시각, 원인으로 보이는 메시지를 찾아 설명하세요.\n\
- CPU·메모리 사용률이 높은 컨테이너, 메모리 제한에 근접한 컨테이너, `docker system df`의 회수 가능한 용량을 알려 주세요.\n\
- 마지막에 우선순위가 높은 조치를 명령어와 함께 제안하세요.\n";

#[cfg(test)]
mod tests {
    use super::*;

    const UBUNTU_MISSING: &str = "uid=1000\nsudo=1\nos_id=ubuntu\nos_like=debian\nos_version=22.04\nos_codename=jammy\nos_name=Ubuntu 22.04.4 LTS\ninstalled=0\n";

    #[test]
    fn parses_probe_without_docker() {
        let status = parse_probe(UBUNTU_MISSING);
        assert!(!status.installed);
        assert!(!status.is_root);
        assert!(status.sudo_nopasswd);
        assert_eq!(status.os_id, "ubuntu");
        assert_eq!(status.os_codename, "jammy");
        assert_eq!(status.distro(), Distro::Ubuntu);
    }

    #[test]
    fn parses_probe_with_docker() {
        let status = parse_probe(
            "uid=1000\nsudo=0\nos_id=amzn\nos_version=2023\ninstalled=1\nclient=25.0.3\ndaemon=sudo\nserver=25.0.3\ncompose=plugin\n",
        );
        assert!(status.installed);
        assert_eq!(status.client_version.as_deref(), Some("25.0.3"));
        assert_eq!(status.daemon, DaemonState::RunningWithSudo);
        assert_eq!(status.compose, ComposeKind::Plugin);
        assert_eq!(status.distro(), Distro::AmazonLinux2023);
    }

    #[test]
    fn picks_install_script_per_distro() {
        let mut status = parse_probe(UBUNTU_MISSING);
        let script = status.install_script().unwrap();
        assert!(script.contains("S=\"sudo -n\""));
        assert!(script.contains("download.docker.com/linux/ubuntu"));
        assert!(script.contains("systemctl enable --now docker"));
        assert!(script.contains("{{.ServerVersion}}"));

        status.os_id = "amzn".into();
        status.os_version = "2023".into();
        assert!(status.install_script().unwrap().contains("$S dnf install -y docker"));

        status.os_id = "rocky".into();
        status.os_like = "rhel centos fedora".into();
        assert!(status
            .install_script()
            .unwrap()
            .contains("download.docker.com/linux/centos/docker-ce.repo"));

        status.os_id = "arch".into();
        status.os_like.clear();
        assert!(status.install_script().unwrap().contains("get.docker.com"));

        status.is_root = true;
        let script = status.install_script().unwrap();
        assert!(script.starts_with("set -e\nS=\"\"\n"));
        assert!(!script.contains("usermod"));
    }

    #[test]
    fn refuses_install_without_privilege_or_when_installed() {
        let mut status = parse_probe(UBUNTU_MISSING);
        status.sudo_nopasswd = false;
        assert!(status.install_script().is_err());
        assert!(instructions(Some(&status)).contains("대신 설치할 수 없습니다"));

        status.sudo_nopasswd = true;
        status.installed = true;
        assert!(status.install_script().is_err());
        assert!(install_script(None).is_err());
    }

    #[test]
    fn missing_docker_instructions_require_notice() {
        let text = instructions(Some(&parse_probe(UBUNTU_MISSING)));
        assert!(text.contains("\"현재 도커는 설치되어 있지 않습니다.\""));
        assert!(text.contains(&format!("{TOOL_FENCE}\n{INSTALL_COMMAND}\n```")));
        assert!(text.contains("Ubuntu 22.04.4 LTS"));
    }
}
