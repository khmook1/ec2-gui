use serde::{Deserialize, Serialize};
use ssh2::Session;

use super::remote_fs::{exec_remote_command, exec_remote_command_checked};

const SUDO_GROUPS: [&str; 3] = ["sudo", "wheel", "admin"];

/// root 이면 그대로, 아니면 비대화형 sudo 로 실행. stderr 는 오류 메시지로 쓰기 위해 stdout 으로 합친다.
const PRIVILEGED_PRELUDE: &str = r#"exec 2>&1
if [ "$(id -u)" = "0" ]; then SUDO=""; else SUDO="sudo -n"; fi
"#;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteUser {
    pub username: String,
    pub uid: u32,
    pub gid: u32,
    pub home: String,
    pub shell: String,
    pub groups: Vec<String>,
    pub has_sudo_group: bool,
    pub has_docker_group: bool,
    /// sudoers 어디서든 NOPASSWD 가 적용되는지 (`sudo -l -U`)
    pub nopasswd_sudo: bool,
    /// 이 앱이 만든 `/etc/sudoers.d/90-ec2-gui-<user>` 가 있는지
    pub managed_sudo: bool,
    pub is_current: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRemoteUserInput {
    pub username: String,
    pub shell: Option<String>,
    #[serde(default)]
    pub groups: Vec<String>,
    pub ssh_public_key: Option<String>,
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn managed_sudoers_path(username: &str) -> String {
    format!("/etc/sudoers.d/90-ec2-gui-{username}")
}

/// useradd 기본 규칙과 같은 보수적인 이름 규칙 (셸 인자로 안전해야 함)
fn validate_account_name<'a>(raw: &'a str, kind: &str) -> Result<&'a str, String> {
    let name = raw.trim();
    let mut chars = name.chars();
    let valid_first = matches!(chars.next(), Some(c) if c.is_ascii_lowercase() || c == '_');
    let valid_rest =
        chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-');

    if name.is_empty() || name.len() > 32 || !valid_first || !valid_rest {
        return Err(format!(
            "올바르지 않은 {kind} 이름입니다: 소문자/숫자/_/- 만 사용할 수 있습니다."
        ));
    }
    Ok(name)
}

fn validate_shell(raw: &str) -> Result<&str, String> {
    let shell = raw.trim();
    let valid = shell.starts_with('/')
        && shell.len() <= 128
        && shell
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '.' | '-'));
    if !valid {
        return Err("올바르지 않은 셸 경로입니다.".to_string());
    }
    Ok(shell)
}

fn validate_ssh_public_key(raw: &str) -> Result<&str, String> {
    let key = raw.trim();
    if key.contains('\n') || key.contains('\r') {
        return Err("SSH 공개키는 한 줄이어야 합니다.".to_string());
    }
    let known_prefix = ["ssh-", "ecdsa-", "sk-"]
        .iter()
        .any(|prefix| key.starts_with(prefix));
    if !known_prefix || key.split_whitespace().count() < 2 {
        return Err("올바르지 않은 SSH 공개키 형식입니다.".to_string());
    }
    Ok(key)
}

fn run_privileged(session: &Session, script: &str) -> Result<String, String> {
    let command = format!("{PRIVILEGED_PRELUDE}{script}");
    exec_remote_command_checked(session, &command).map_err(|error| {
        if error.contains("a password is required") || error.contains("a terminal is required") {
            "비밀번호 없는 sudo 권한이 필요합니다.".to_string()
        } else {
            error
        }
    })
}

pub fn list_users(session: &Session, current_user: &str) -> Result<Vec<RemoteUser>, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e
if [ "$(id -u)" = "0" ]; then SUDO=""; else SUDO="sudo -n"; fi
UID_MIN=$(awk '/^UID_MIN/ {print $2}' /etc/login.defs 2>/dev/null)
[ -z "$UID_MIN" ] && UID_MIN=1000

getent passwd | while IFS=: read -r name _pw uid gid _gecos home shell; do
  if [ "$uid" != "0" ]; then
    [ "$uid" -lt "$UID_MIN" ] 2>/dev/null && continue
    [ "$uid" = "65534" ] && continue
  fi
  groups=$(id -Gn "$name" 2>/dev/null)
  nopass=0
  if $SUDO sudo -l -U "$name" 2>/dev/null | grep -q 'NOPASSWD'; then
    nopass=1
  fi
  managed=0
  if $SUDO test -f "/etc/sudoers.d/90-ec2-gui-$name" 2>/dev/null; then
    managed=1
  fi
  printf 'user\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$uid" "$gid" "$home" "$shell" "$groups" "$nopass" "$managed"
done
"#,
    )?;

    Ok(parse_users(&output, current_user))
}

fn parse_users(output: &str, current_user: &str) -> Vec<RemoteUser> {
    let mut users: Vec<RemoteUser> = output
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split('\t').collect();
            if fields.len() != 9 || fields[0] != "user" {
                return None;
            }
            let username = fields[1].trim().to_string();
            let uid = fields[2].trim().parse().ok()?;
            let gid = fields[3].trim().parse().unwrap_or(0);
            let groups: Vec<String> = fields[6]
                .split_whitespace()
                .map(|group| group.to_string())
                .collect();
            let has_sudo_group = groups
                .iter()
                .any(|group| SUDO_GROUPS.contains(&group.as_str()));
            let has_docker_group = groups.iter().any(|group| group == "docker");

            Some(RemoteUser {
                is_current: username == current_user,
                username,
                uid,
                gid,
                home: fields[4].trim().to_string(),
                shell: fields[5].trim().to_string(),
                groups,
                has_sudo_group,
                has_docker_group,
                nopasswd_sudo: fields[7].trim() == "1",
                managed_sudo: fields[8].trim() == "1",
            })
        })
        .collect();

    users.sort_by_key(|user| user.uid);
    users
}

pub fn list_groups(session: &Session) -> Result<Vec<String>, String> {
    let output = exec_remote_command(session, "getent group 2>/dev/null | cut -d: -f1")?;
    Ok(parse_groups(&output))
}

fn parse_groups(output: &str) -> Vec<String> {
    let mut groups: Vec<String> = output
        .lines()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    groups.sort();
    groups.dedup();
    groups
}

pub fn add_user_to_group(session: &Session, username: &str, group: &str) -> Result<(), String> {
    let username = validate_account_name(username, "사용자")?;
    let group = validate_account_name(group, "그룹")?;
    let user_q = shell_quote(username);
    let group_q = shell_quote(group);

    run_privileged(
        session,
        &format!(
            r#"getent passwd {user_q} >/dev/null || {{ echo "사용자를 찾을 수 없습니다: {username}"; exit 1; }}
getent group {group_q} >/dev/null || {{ echo "그룹을 찾을 수 없습니다: {group}"; exit 1; }}
$SUDO usermod -aG {group_q} {user_q}
"#
        ),
    )?;
    Ok(())
}

pub fn remove_user_from_group(
    session: &Session,
    current_user: &str,
    username: &str,
    group: &str,
) -> Result<(), String> {
    let username = validate_account_name(username, "사용자")?;
    let group = validate_account_name(group, "그룹")?;
    if username == current_user && SUDO_GROUPS.contains(&group) {
        return Err("현재 접속 계정의 sudo 그룹은 제거할 수 없습니다.".to_string());
    }

    run_privileged(
        session,
        &format!(
            "$SUDO gpasswd -d {} {} >/dev/null\n",
            shell_quote(username),
            shell_quote(group)
        ),
    )?;
    Ok(())
}

pub fn set_passwordless_sudo(
    session: &Session,
    current_user: &str,
    username: &str,
    enabled: bool,
) -> Result<(), String> {
    let username = validate_account_name(username, "사용자")?;
    if username == "root" {
        return Err("root 계정의 sudo 설정은 변경할 수 없습니다.".to_string());
    }
    if !enabled && username == current_user {
        return Err("현재 접속 계정의 sudo 권한은 회수할 수 없습니다.".to_string());
    }

    let user_q = shell_quote(username);
    let path_q = shell_quote(&managed_sudoers_path(username));

    let script = if enabled {
        format!(
            r#"getent passwd {user_q} >/dev/null || {{ echo "사용자를 찾을 수 없습니다: {username}"; exit 1; }}
TMP=$(mktemp) || exit 1
printf '%s ALL=(ALL) NOPASSWD:ALL\n' {user_q} > "$TMP"
if ! $SUDO visudo -cf "$TMP" >/dev/null; then
  rm -f "$TMP"
  echo "sudoers 검증에 실패했습니다."
  exit 1
fi
$SUDO install -m 0440 -o root -g root "$TMP" {path_q}
STATUS=$?
rm -f "$TMP"
exit $STATUS
"#
        )
    } else {
        format!("$SUDO rm -f {path_q}\n")
    };

    run_privileged(session, &script)?;
    Ok(())
}

pub fn create_user(session: &Session, input: &CreateRemoteUserInput) -> Result<(), String> {
    let username = validate_account_name(&input.username, "사용자")?;
    let shell = validate_shell(input.shell.as_deref().unwrap_or("/bin/bash"))?;
    let groups = input
        .groups
        .iter()
        .map(|group| validate_account_name(group, "그룹"))
        .collect::<Result<Vec<_>, _>>()?;
    let ssh_key = input
        .ssh_public_key
        .as_deref()
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .map(validate_ssh_public_key)
        .transpose()?;

    let user_q = shell_quote(username);
    let shell_q = shell_quote(shell);

    let mut script = format!(
        r#"if getent passwd {user_q} >/dev/null; then echo "이미 존재하는 사용자입니다: {username}"; exit 1; fi
[ -x {shell_q} ] || {{ echo "셸을 찾을 수 없습니다: {shell}"; exit 1; }}
"#
    );
    for group in &groups {
        let group_q = shell_quote(group);
        script.push_str(&format!(
            "getent group {group_q} >/dev/null || {{ echo \"그룹을 찾을 수 없습니다: {group}\"; exit 1; }}\n"
        ));
    }

    let group_arg = if groups.is_empty() {
        String::new()
    } else {
        format!(" -G {}", shell_quote(&groups.join(",")))
    };
    script.push_str(&format!(
        "$SUDO useradd -m -s {shell_q}{group_arg} {user_q} || exit 1\n"
    ));

    if let Some(key) = ssh_key {
        let key_q = shell_quote(key);
        script.push_str(&format!(
            r#"set -e
HOME_DIR=$(getent passwd {user_q} | cut -d: -f6)
PRIMARY=$(id -gn {user_q})
$SUDO install -d -m 700 -o {user_q} -g "$PRIMARY" "$HOME_DIR/.ssh"
printf '%s\n' {key_q} | $SUDO tee "$HOME_DIR/.ssh/authorized_keys" >/dev/null
$SUDO chmod 600 "$HOME_DIR/.ssh/authorized_keys"
$SUDO chown {user_q}:"$PRIMARY" "$HOME_DIR/.ssh/authorized_keys"
"#
        ));
    }

    run_privileged(session, &script)?;
    Ok(())
}

pub fn delete_user(
    session: &Session,
    current_user: &str,
    username: &str,
    remove_home: bool,
) -> Result<(), String> {
    let username = validate_account_name(username, "사용자")?;
    if username == "root" {
        return Err("root 계정은 삭제할 수 없습니다.".to_string());
    }
    if username == current_user {
        return Err("현재 접속 계정은 삭제할 수 없습니다.".to_string());
    }

    let user_q = shell_quote(username);
    let path_q = shell_quote(&managed_sudoers_path(username));
    let remove_flag = if remove_home { " -r" } else { "" };

    run_privileged(
        session,
        &format!(
            r#"UID_MIN=$(awk '/^UID_MIN/ {{print $2}}' /etc/login.defs 2>/dev/null)
[ -z "$UID_MIN" ] && UID_MIN=1000
TARGET_UID=$(id -u {user_q} 2>/dev/null) || {{ echo "사용자를 찾을 수 없습니다: {username}"; exit 1; }}
if [ "$TARGET_UID" -lt "$UID_MIN" ]; then echo "시스템 계정은 삭제할 수 없습니다."; exit 1; fi
$SUDO userdel{remove_flag} {user_q} || exit 1
$SUDO rm -f {path_q}
"#
        ),
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        parse_groups, parse_users, validate_account_name, validate_shell, validate_ssh_public_key,
    };

    #[test]
    fn parses_users() {
        let sample = "user\troot\t0\t0\t/root\t/bin/bash\troot\t1\t0\n\
user\tubuntu\t1000\t1000\t/home/ubuntu\t/bin/bash\tubuntu adm sudo docker\t1\t0\n\
user\tdeploy\t1001\t1001\t/home/deploy\t/bin/sh\tdeploy\t0\t1\n\
garbage line\n";
        let users = parse_users(sample, "ubuntu");
        assert_eq!(users.len(), 3);

        let ubuntu = &users[1];
        assert_eq!(ubuntu.username, "ubuntu");
        assert_eq!(ubuntu.uid, 1000);
        assert_eq!(ubuntu.groups, vec!["ubuntu", "adm", "sudo", "docker"]);
        assert!(ubuntu.has_sudo_group);
        assert!(ubuntu.has_docker_group);
        assert!(ubuntu.nopasswd_sudo);
        assert!(!ubuntu.managed_sudo);
        assert!(ubuntu.is_current);

        let deploy = &users[2];
        assert!(!deploy.has_sudo_group);
        assert!(!deploy.nopasswd_sudo);
        assert!(deploy.managed_sudo);
        assert!(!deploy.is_current);
    }

    #[test]
    fn users_are_sorted_by_uid() {
        let sample = "user\tb\t1002\t1002\t/home/b\t/bin/bash\tb\t0\t0\n\
user\ta\t1001\t1001\t/home/a\t/bin/bash\ta\t0\t0\n";
        let users = parse_users(sample, "");
        assert_eq!(users[0].username, "a");
        assert_eq!(users[1].username, "b");
    }

    #[test]
    fn parses_groups_sorted_unique() {
        let groups = parse_groups("sudo\ndocker\n\nadm\ndocker\n");
        assert_eq!(groups, vec!["adm", "docker", "sudo"]);
    }

    #[test]
    fn validates_account_names() {
        assert!(validate_account_name("deploy_user-1", "사용자").is_ok());
        assert!(validate_account_name("_svc", "사용자").is_ok());
        assert!(validate_account_name("1user", "사용자").is_err());
        assert!(validate_account_name("User", "사용자").is_err());
        assert!(validate_account_name("a;rm -rf /", "사용자").is_err());
        assert!(validate_account_name("", "사용자").is_err());
        assert!(validate_account_name(&"a".repeat(33), "사용자").is_err());
    }

    #[test]
    fn validates_shell_and_key() {
        assert!(validate_shell("/bin/bash").is_ok());
        assert!(validate_shell("bash").is_err());
        assert!(validate_shell("/bin/bash; id").is_err());

        assert!(validate_ssh_public_key("ssh-ed25519 AAAAC3Nz user@host").is_ok());
        assert!(validate_ssh_public_key("ssh-ed25519").is_err());
        assert!(validate_ssh_public_key("not-a-key AAAA").is_err());
        assert!(validate_ssh_public_key("ssh-rsa AAAA\nssh-rsa BBBB").is_err());
    }
}
