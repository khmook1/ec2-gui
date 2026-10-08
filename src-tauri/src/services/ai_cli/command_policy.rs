//! AI가 요청한 원격 명령의 위험도를 판별한다.
//! 허용 목록 방식이라 모르는 명령은 모두 사용자 확인 대상이 된다.
//! 조회 명령이라도 비밀정보(환경 변수, 키 파일 등)를 출력할 수 있으면 확인 대상이다.

/// 어떤 인자와도 상태를 바꾸지 않는 프로그램
const ALWAYS_READ_ONLY: &[&str] = &[
    "arch", "basename", "blkid", "cat", "cd", "cksum", "cmp", "column", "comm", "cut", "df",
    "diff", "dig", "dirname", "du", "echo", "egrep", "false", "fgrep", "file", "findmnt", "free",
    "getent", "grep", "groups", "head", "host", "id", "jq", "last", "lastlog", "ls", "lsblk",
    "lscpu", "lsmem", "lsmod", "lsof", "lspci", "lsusb", "md5sum", "netstat", "nl", "nproc",
    "nslookup", "pgrep", "ping", "printf", "ps", "pstree", "pwd", "readlink", "realpath", "rg",
    "sha1sum", "sha256sum", "sha512sum", "ss", "stat", "tac", "tail", "test", "tr", "tree",
    "true", "type", "uname", "uniq", "uptime", "w", "wc", "whereis", "which", "who", "whoami",
    "zcat", "zgrep", "[",
];

/// 파일 내용을 출력할 수 있는 조회 프로그램 (인자로 비밀 파일을 받으면 민감 명령)
const FILE_READERS: &[&str] = &[
    "awk", "cat", "cmp", "cut", "diff", "egrep", "fgrep", "gawk", "grep", "head", "jq", "mawk",
    "nl", "rg", "sed", "sort", "tac", "tail", "tr", "uniq", "zcat", "zgrep",
];

const ENV_REASON: &str = "환경 변수가 그대로 출력되어 비밀번호·토큰이 노출될 수 있습니다.";
const INSPECT_REASON: &str = "컨테이너 설정의 환경 변수(비밀번호·토큰)가 노출될 수 있습니다.";
const COMPOSE_CONFIG_REASON: &str = "compose 설정에 포함된 환경 변수·비밀값이 노출될 수 있습니다.";
const SECRET_FILE_REASON: &str = "키·인증 정보·.env 같은 비밀 파일 내용을 읽습니다.";

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CommandRisk {
    /// 상태를 바꾸지 않고 비밀정보도 출력하지 않는 조회
    ReadOnly,
    /// 조회지만 비밀정보가 노출될 수 있음
    Sensitive(&'static str),
    /// 서버 상태를 바꿀 수 있거나 판별할 수 없음
    Mutating,
}

pub fn classify(command: &str) -> CommandRisk {
    let Some(segments) = split_segments(command) else {
        return CommandRisk::Mutating;
    };
    let mut sensitive = None;
    for segment in &segments {
        let words = words(segment);
        if !words_read_only(&words) {
            return CommandRisk::Mutating;
        }
        sensitive = sensitive.or_else(|| sensitive_reason(&words));
    }
    sensitive.map_or(CommandRisk::ReadOnly, CommandRisk::Sensitive)
}

/// 앞쪽 변수 대입, `sudo`·`timeout` 같은 래퍼를 벗긴 실제 명령 단어
fn unwrap_command(words: &[String]) -> &[String] {
    let start = words.iter().take_while(|word| is_assignment(word)).count();
    let words = &words[start..];
    let Some(first) = words.first() else {
        return words;
    };
    let program = first.rsplit('/').next().unwrap_or(first);
    let args = &words[1..];
    match program {
        "sudo" => {
            let mut index = 0;
            while let Some(arg) = args.get(index) {
                if !arg.starts_with('-') {
                    break;
                }
                index += if matches!(arg.as_str(), "-u" | "-g" | "-U" | "-C" | "-h" | "-p") {
                    2
                } else {
                    1
                };
            }
            unwrap_command(args.get(index..).unwrap_or(&[]))
        }
        "timeout" | "nice" | "stdbuf" | "time" => {
            let skip = args
                .iter()
                .take_while(|arg| {
                    arg.starts_with('-') || arg.chars().next().is_some_and(|c| c.is_ascii_digit())
                })
                .count();
            unwrap_command(&args[skip..])
        }
        "env" => {
            let skip = args
                .iter()
                .take_while(|arg| arg.starts_with('-') || is_assignment(arg))
                .count();
            if skip == args.len() {
                words
            } else {
                unwrap_command(&args[skip..])
            }
        }
        _ => words,
    }
}

fn sensitive_reason(words: &[String]) -> Option<&'static str> {
    let words = unwrap_command(words);
    let first = words.first()?;
    let program = first.rsplit('/').next().unwrap_or(first);
    let args = &words[1..];

    match program {
        "printenv" | "env" => return Some(ENV_REASON),
        "docker" | "podman" => return docker_sensitive_reason(args),
        _ => {}
    }
    if FILE_READERS.contains(&program)
        && args
            .iter()
            .any(|arg| !arg.starts_with('-') && is_secret_path(arg))
    {
        return Some(SECRET_FILE_REASON);
    }
    None
}

fn docker_sensitive_reason(args: &[String]) -> Option<&'static str> {
    let positional = docker_positional(args);
    let inspect = match positional.first().copied() {
        Some("inspect") => true,
        Some("container" | "image") => positional.get(1) == Some(&"inspect"),
        Some("compose") if positional.get(1) == Some(&"config") => {
            return Some(COMPOSE_CONFIG_REASON)
        }
        _ => false,
    };
    if !inspect {
        return None;
    }
    let safe_format = inspect_format(args).is_some_and(|format| {
        let compact: String = format.chars().filter(|c| !c.is_whitespace()).collect();
        !compact.contains("Env")
            && !compact.contains(".Config}}")
            && compact != "{{json.}}"
            && !compact.contains("{{.}}")
    });
    (!safe_format).then_some(INSPECT_REASON)
}

fn inspect_format(args: &[String]) -> Option<&str> {
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if let Some(value) = arg.strip_prefix("--format=") {
            return Some(value);
        }
        if arg == "--format" || arg == "-f" {
            return iter.next().map(String::as_str);
        }
    }
    None
}

fn is_secret_path(arg: &str) -> bool {
    let lower = arg.to_ascii_lowercase();
    let base = lower.rsplit('/').next().unwrap_or(&lower);
    let private_key = ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"]
        .iter()
        .any(|name| base.starts_with(name))
        && !base.ends_with(".pub");
    private_key
        || base == ".env"
        || base.starts_with(".env.")
        || base.ends_with(".env")
        || [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"]
            .iter()
            .any(|ext| base.ends_with(ext))
        || base.contains("credential")
        || base.contains("secret")
        || [
            "/etc/shadow",
            "/etc/gshadow",
            ".aws/credentials",
            ".docker/config.json",
            ".git-credentials",
            ".netrc",
            ".pgpass",
            ".kube/config",
            "kubeconfig",
            "/run/secrets",
        ]
        .iter()
        .any(|pattern| lower.contains(pattern))
}

/// `;`, `&&`, `||`, `|`, `&`, 줄바꿈 기준으로 나눈다.
/// 명령 치환·프로세스 치환·`/dev/null`이 아닌 출력 리다이렉트가 있으면 None.
fn split_segments(command: &str) -> Option<Vec<String>> {
    let chars: Vec<char> = command.chars().collect();
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut in_single = false;
    let mut in_double = false;
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        let next = chars.get(index + 1).copied();

        if in_single {
            if ch == '\'' {
                in_single = false;
            }
            current.push(ch);
            index += 1;
            continue;
        }

        match ch {
            '\\' => {
                current.push(ch);
                if let Some(escaped) = next {
                    current.push(escaped);
                    index += 1;
                }
            }
            '`' => return None,
            '$' if next == Some('(') => return None,
            '"' => {
                in_double = !in_double;
                current.push(ch);
            }
            _ if in_double => current.push(ch),
            '\'' => {
                in_single = true;
                current.push(ch);
            }
            '<' if next == Some('(') => return None,
            '>' => {
                // `2>`, `&>`의 fd 표기는 인자로 남지 않게 떼어 낸다.
                if current.ends_with(|c: char| c.is_ascii_digit() || c == '&')
                    && current[..current.len() - 1].ends_with(char::is_whitespace)
                {
                    current.pop();
                }
                index += 1;
                if chars.get(index) == Some(&'>') {
                    index += 1;
                }
                if chars.get(index) == Some(&'&') {
                    index += 1;
                    while chars.get(index).is_some_and(char::is_ascii_digit) {
                        index += 1;
                    }
                    continue;
                }
                while chars.get(index).is_some_and(|c| c.is_whitespace()) {
                    index += 1;
                }
                let target: String = chars[index..]
                    .iter()
                    .take_while(|c| !c.is_whitespace() && !matches!(c, ';' | '|' | '&'))
                    .collect();
                if target != "/dev/null" {
                    return None;
                }
                index += target.chars().count();
                continue;
            }
            ';' | '\n' => segments.push(std::mem::take(&mut current)),
            '|' | '&' => {
                if next == Some(ch) {
                    index += 1;
                }
                segments.push(std::mem::take(&mut current));
            }
            _ => current.push(ch),
        }
        index += 1;
    }

    if in_single || in_double {
        return None;
    }
    segments.push(current);
    Some(
        segments
            .into_iter()
            .map(|segment| segment.trim().to_string())
            .filter(|segment| !segment.is_empty())
            .collect(),
    )
}

/// 따옴표를 벗긴 단어 목록
fn words(segment: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut has_word = false;
    let mut in_single = false;
    let mut in_double = false;
    let mut chars = segment.chars();

    while let Some(ch) = chars.next() {
        match ch {
            '\'' if !in_double => {
                in_single = !in_single;
                has_word = true;
            }
            '"' if !in_single => {
                in_double = !in_double;
                has_word = true;
            }
            '\\' if !in_single => {
                if let Some(escaped) = chars.next() {
                    current.push(escaped);
                    has_word = true;
                }
            }
            c if c.is_whitespace() && !in_single && !in_double => {
                if has_word {
                    words.push(std::mem::take(&mut current));
                    has_word = false;
                }
            }
            c => {
                current.push(c);
                has_word = true;
            }
        }
    }
    if has_word {
        words.push(current);
    }
    words
}

fn is_assignment(word: &str) -> bool {
    word.split_once('=').is_some_and(|(name, _)| {
        !name.is_empty()
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
            && !name.starts_with(|c: char| c.is_ascii_digit())
    })
}

fn has_any(args: &[String], flags: &[&str]) -> bool {
    args.iter().any(|arg| flags.contains(&arg.as_str()))
}

/// 첫 번째 비옵션 인자 (서브커맨드)
fn subcommand(args: &[String]) -> Option<&str> {
    args.iter()
        .map(String::as_str)
        .find(|arg| !arg.starts_with('-'))
}

fn words_read_only(words: &[String]) -> bool {
    let words: Vec<String> = words
        .iter()
        .skip_while(|word| is_assignment(word))
        .cloned()
        .collect();
    let Some(first) = words.first() else {
        return true;
    };
    let program = first.rsplit('/').next().unwrap_or(first);
    let args = &words[1..];

    if ALWAYS_READ_ONLY.contains(&program) {
        return true;
    }

    match program {
        "sudo" => {
            let mut index = 0;
            while let Some(arg) = args.get(index) {
                if !arg.starts_with('-') {
                    break;
                }
                index += if matches!(arg.as_str(), "-u" | "-g" | "-U" | "-C" | "-h" | "-p") {
                    2
                } else {
                    1
                };
            }
            words_read_only(args.get(index..).unwrap_or(&[]))
        }
        "timeout" | "nice" | "stdbuf" | "time" | "env" => {
            let rest: Vec<String> = args
                .iter()
                .skip_while(|arg| {
                    arg.starts_with('-')
                        || is_assignment(arg)
                        || arg.chars().next().is_some_and(|c| c.is_ascii_digit())
                })
                .cloned()
                .collect();
            words_read_only(&rest)
        }
        "command" => {
            has_any(args, &["-v", "-V"]) || words_read_only(args)
        }
        "printenv" => true,
        "awk" | "gawk" | "mawk" => !args
            .iter()
            .any(|arg| arg.contains("system") || arg.contains('>') || arg.contains('|')),
        "sed" => !args.iter().any(|arg| {
            arg.starts_with("--in-place")
                || (arg.starts_with('-') && !arg.starts_with("--") && arg.contains('i'))
        }),
        "sort" => !args.iter().any(|arg| arg == "-o" || arg.starts_with("--output")),
        "find" => !has_any(
            args,
            &["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"],
        ),
        "top" => args.iter().any(|arg| arg.starts_with("-b")),
        "hostname" => args.iter().all(|arg| arg.starts_with('-')),
        "date" => !args
            .iter()
            .any(|arg| arg == "-s" || arg.starts_with("--set")),
        "dmesg" => !has_any(args, &["-c", "-C", "--clear", "--read-clear"]),
        "sysctl" => !args.iter().any(|arg| arg == "-w" || arg.contains('=')),
        "mount" => args.iter().all(|arg| arg.starts_with('-')),
        "crontab" => has_any(args, &["-l"]),
        "ulimit" => args.iter().all(|arg| arg.starts_with('-')),
        "ifconfig" => args.len() <= 1,
        "route" => args.iter().all(|arg| arg.starts_with('-')),
        "ip" => {
            let positional: Vec<&str> = args
                .iter()
                .map(String::as_str)
                .filter(|arg| !arg.starts_with('-'))
                .collect();
            match positional.get(1) {
                None => true,
                Some(action) => matches!(*action, "show" | "list" | "ls" | "get"),
            }
        }
        "journalctl" => !args.iter().any(|arg| {
            arg.starts_with("--vacuum")
                || matches!(arg.as_str(), "--rotate" | "--flush" | "--sync" | "--setup-keys" | "--relinquish-var")
        }),
        "systemctl" => matches!(
            subcommand(args),
            None | Some(
                "status"
                    | "show"
                    | "cat"
                    | "list-units"
                    | "list-unit-files"
                    | "list-timers"
                    | "list-sockets"
                    | "list-dependencies"
                    | "is-active"
                    | "is-enabled"
                    | "is-failed"
                    | "is-system-running"
            )
        ),
        "service" => args
            .last()
            .is_some_and(|arg| matches!(arg.as_str(), "status" | "--status-all")),
        "docker" | "podman" => docker_read_only(args),
        "kubectl" => matches!(
            subcommand(args),
            Some("get" | "describe" | "logs" | "top" | "version" | "cluster-info" | "api-resources" | "explain")
        ),
        "git" => matches!(
            subcommand(args),
            Some("status" | "log" | "diff" | "show" | "rev-parse" | "describe" | "ls-files" | "blame" | "remote")
        ) && !has_any(args, &["add", "remove", "rm", "rename", "set-url", "prune"]),
        "nginx" => args
            .iter()
            .all(|arg| matches!(arg.as_str(), "-t" | "-T" | "-v" | "-V" | "-q")),
        "iptables" | "ip6tables" => {
            has_any(args, &["-L", "-S", "--list", "--list-rules"])
                && !args.iter().any(|arg| {
                    matches!(
                        arg.as_str(),
                        "-A" | "-D" | "-I" | "-R" | "-F" | "-X" | "-P" | "-N" | "-E" | "-Z"
                    )
                })
        }
        "ufw" => subcommand(args) == Some("status"),
        "dpkg" => args
            .iter()
            .all(|arg| matches!(arg.as_str(), "-l" | "-s" | "-L" | "-S" | "--list" | "--status" | "--listfiles" | "--search") || !arg.starts_with('-'))
            && args.iter().any(|arg| arg.starts_with('-')),
        "rpm" => args.iter().any(|arg| arg.starts_with("-q")),
        "apt" | "apt-cache" => matches!(
            subcommand(args),
            Some("list" | "show" | "policy" | "search" | "depends" | "rdepends" | "madison")
        ),
        "yum" | "dnf" => matches!(
            subcommand(args),
            Some("list" | "info" | "search" | "repolist" | "provides")
        ),
        "snap" => matches!(subcommand(args), Some("list" | "info")),
        _ => false,
    }
}

/// docker/compose 인자 중 옵션과 옵션 값(`-p app`, `--file x.yml` 등)을 뺀 위치 인자
fn docker_positional(args: &[String]) -> Vec<&str> {
    const VALUE_FLAGS: &[&str] = &[
        "-H", "--host", "-c", "--context", "--config", "-l", "--log-level", "-p",
        "--project-name", "-f", "--file", "--format", "--env-file", "--profile",
        "--project-directory", "--ansi", "--progress",
    ];
    let mut positional = Vec::new();
    let mut iter = args.iter().map(String::as_str);
    while let Some(arg) = iter.next() {
        if VALUE_FLAGS.contains(&arg) {
            iter.next();
        } else if !arg.starts_with('-') {
            positional.push(arg);
        }
    }
    positional
}

fn docker_read_only(args: &[String]) -> bool {
    let positional = docker_positional(args);
    let Some(&first) = positional.first() else {
        return true;
    };
    let second = positional.get(1).copied();

    match first {
        "ps" | "images" | "inspect" | "logs" | "stats" | "info" | "version" | "top" | "port"
        | "diff" | "history" | "df" | "events" => true,
        "container" => matches!(
            second,
            Some("ls" | "ps" | "list" | "inspect" | "logs" | "top" | "port" | "stats" | "diff")
        ),
        "image" => matches!(second, Some("ls" | "list" | "inspect" | "history")),
        "network" | "volume" | "context" => matches!(second, Some("ls" | "list" | "inspect")),
        "system" => matches!(second, Some("df" | "info")),
        "compose" => matches!(
            second,
            Some("ps" | "logs" | "config" | "ls" | "images" | "top" | "version")
        ),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::{classify, CommandRisk};

    fn is_read_only(command: &str) -> bool {
        classify(command) == CommandRisk::ReadOnly
    }

    fn is_sensitive(command: &str) -> bool {
        matches!(classify(command), CommandRisk::Sensitive(_))
    }

    #[test]
    fn plain_queries_are_read_only() {
        for command in [
            "df -h",
            "free -m && uptime",
            "ps aux | grep nginx | head -n 20",
            "sudo -n du -sh /var/log/* 2>/dev/null | sort -h",
            "journalctl -u nginx --no-pager -n 100",
            "systemctl --no-pager status nginx",
            "docker ps -a",
            "docker compose logs --tail 50",
            "find /var/log -name '*.log' -size +10M",
            "awk '{print $1}' /etc/passwd",
            "top -bn1 | head -20",
            "cat /etc/os-release; uname -a",
            "ip addr show",
            "LC_ALL=C ls -la ~",
            "grep 'a > b' file.txt",
            "sudo -n -l",
            "docker ps -a --format '{{json .}}'",
            "docker stats --no-stream",
            "docker logs --tail 200 --timestamps web 2>&1 | grep -iE 'error|warn' | tail -n 100",
            "docker inspect --format '{{json .State}}' web",
            "sudo -n docker container inspect -f '{{.RestartCount}}' web",
            "docker events --since 1h --until 0s",
            "docker compose -p app ps",
            "docker compose -f /srv/app/compose.yml logs --tail 200",
            "cat ~/.ssh/id_rsa.pub",
            "env LC_ALL=C ls",
        ] {
            assert!(is_read_only(command), "{command}");
        }
    }

    #[test]
    fn secret_exposing_queries_are_sensitive() {
        for command in [
            "printenv",
            "env",
            "sudo -n env | grep TOKEN",
            "docker inspect web",
            "docker inspect --format '{{json .Config.Env}}' web",
            "docker inspect -f '{{json .Config}}' web",
            "docker container inspect web | jq '.[0].State'",
            "docker compose -p app config",
            "cat /srv/app/.env",
            "sudo -n cat /etc/shadow",
            "tail -n 5 ~/.ssh/id_ed25519",
            "head ~/.aws/credentials",
            "grep -r password /home/ubuntu/app/.env.production",
            "cat /etc/nginx/ssl/server.key",
        ] {
            assert!(is_sensitive(command), "{command}");
        }
    }

    #[test]
    fn state_changing_commands_need_approval() {
        for command in [
            "rm -rf /tmp/x",
            "echo hi > /etc/motd",
            "cat a >> b",
            "sudo -n systemctl restart nginx",
            "docker rm -f web",
            "docker system prune -af",
            "find / -name core -delete",
            "find . -exec rm {} \\;",
            "sed -i 's/a/b/' file",
            "ls $(rm -rf /)",
            "ls `whoami`",
            "awk 'BEGIN{system(\"reboot\")}'",
            "journalctl --vacuum-size=100M",
            "ip route add default via 10.0.0.1",
            "hostname newname",
            "sysctl -w vm.swappiness=10",
            "curl -X POST https://example.com",
            "df -h; reboot",
            "timeout 5 rm file",
            "echo 'unterminated",
        ] {
            assert!(!is_read_only(command), "{command}");
        }
    }
}
