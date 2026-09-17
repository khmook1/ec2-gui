use serde::Serialize;
use ssh2::Session;

use super::remote_fs::exec_remote_command;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SudoAccess {
    None,
    Group,
    Passwordless,
    Root,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePermissionOverview {
    pub username: String,
    pub uid: u32,
    pub primary_group: String,
    pub groups: Vec<String>,
    pub home: String,
    pub is_root: bool,
    pub sudo: SudoAccess,
    pub docker_access: bool,
    pub can_write_home: bool,
}

/// 현재 SSH 계정의 신원·권한 범위 스냅샷.
pub fn get_permission_overview(session: &Session) -> Result<RemotePermissionOverview, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e

# id 가 이름을 못 풀면 숫자 GID 만 찍힘 → getent 로 이름 복구
resolve_group() {
  g="$1"
  if [ -z "$g" ]; then
    printf '%s' ""
    return
  fi
  case "$g" in
    *[!0-9]*)
      printf '%s' "$g"
      return
      ;;
  esac
  name=$(getent group "$g" 2>/dev/null | cut -d: -f1)
  if [ -n "$name" ]; then
    printf '%s' "$name"
    return
  fi
  # GID 0 은 관례적으로 root
  if [ "$g" = "0" ]; then
    printf '%s' "root"
    return
  fi
  printf 'gid:%s' "$g"
}

USERNAME=$(id -un 2>/dev/null || echo "")
UID_NUM=$(id -u 2>/dev/null || echo "")
PRIMARY_RAW=$(id -gn 2>/dev/null || echo "")
GROUPS_RAW=$(id -Gn 2>/dev/null || echo "")
PRIMARY_GROUP=$(resolve_group "$PRIMARY_RAW")

GROUPS=""
for g in $GROUPS_RAW; do
  resolved=$(resolve_group "$g")
  if [ -z "$resolved" ]; then
    continue
  fi
  if [ -z "$GROUPS" ]; then
    GROUPS="$resolved"
  else
    GROUPS="$GROUPS $resolved"
  fi
done

HOME_DIR=$(printf '%s' "${HOME:-}")
if [ -z "$HOME_DIR" ]; then
  HOME_DIR=$(getent passwd "$USERNAME" 2>/dev/null | cut -d: -f6)
fi
if [ -z "$HOME_DIR" ] && [ -n "$USERNAME" ]; then
  HOME_DIR="/home/$USERNAME"
fi

IS_ROOT=0
if [ "$UID_NUM" = "0" ]; then
  IS_ROOT=1
fi

SUDO=none
if [ "$IS_ROOT" = "1" ]; then
  SUDO=root
elif sudo -n true >/dev/null 2>&1; then
  SUDO=passwordless
else
  case " $GROUPS " in
    *" sudo "*|*" wheel "*|*" admin "*) SUDO=group ;;
  esac
fi

DOCKER=0
if [ "$IS_ROOT" = "1" ]; then
  DOCKER=1
elif [ -S /var/run/docker.sock ] && [ -r /var/run/docker.sock ] && [ -w /var/run/docker.sock ]; then
  DOCKER=1
else
  case " $GROUPS " in
    *" docker "*) DOCKER=1 ;;
  esac
fi

WRITE_HOME=0
if [ -n "$HOME_DIR" ] && [ -w "$HOME_DIR" ]; then
  WRITE_HOME=1
fi

printf 'user\t%s\n' "$USERNAME"
printf 'uid\t%s\n' "$UID_NUM"
printf 'primaryGroup\t%s\n' "$PRIMARY_GROUP"
printf 'groups\t%s\n' "$GROUPS"
printf 'home\t%s\n' "$HOME_DIR"
printf 'isRoot\t%s\n' "$IS_ROOT"
printf 'sudo\t%s\n' "$SUDO"
printf 'dockerAccess\t%s\n' "$DOCKER"
printf 'canWriteHome\t%s\n' "$WRITE_HOME"
"#,
    )?;

    parse_permission_overview(&output)
}

fn normalize_group_name(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }

    // 레거시/부분 실패 응답에서 숫자 GID 가 그대로 올 때
    if value.chars().all(|c| c.is_ascii_digit()) {
        if value == "0" {
            return Some("root".to_string());
        }
        return Some(format!("gid:{value}"));
    }

    Some(value.to_string())
}

fn parse_permission_overview(output: &str) -> Result<RemotePermissionOverview, String> {
    let mut username = String::new();
    let mut uid: Option<u32> = None;
    let mut primary_group = String::new();
    let mut groups: Vec<String> = Vec::new();
    let mut home = String::new();
    let mut is_root = false;
    let mut sudo = SudoAccess::None;
    let mut docker_access = false;
    let mut can_write_home = false;

    for line in output.lines() {
        let Some((key, value)) = line.split_once('\t') else {
            continue;
        };
        let value = value.trim();

        match key.trim() {
            "user" => username = value.to_string(),
            "uid" => {
                uid = value.parse().ok();
            }
            "primaryGroup" => {
                primary_group = normalize_group_name(value).unwrap_or_default();
            }
            "groups" => {
                groups = value
                    .split_whitespace()
                    .filter_map(normalize_group_name)
                    .collect();
            }
            "home" => home = value.to_string(),
            "isRoot" => is_root = value == "1",
            "sudo" => {
                sudo = match value {
                    "root" => SudoAccess::Root,
                    "passwordless" => SudoAccess::Passwordless,
                    "group" => SudoAccess::Group,
                    _ => SudoAccess::None,
                };
            }
            "dockerAccess" => docker_access = value == "1",
            "canWriteHome" => can_write_home = value == "1",
            _ => {}
        }
    }

    let uid = uid.ok_or_else(|| "원격 UID를 해석할 수 없습니다.".to_string())?;
    if username.is_empty() {
        return Err("원격 사용자 이름을 해석할 수 없습니다.".to_string());
    }

    // primary 가 비어 있고 groups 만 있으면 첫 항목을 primary 로 보정
    if primary_group.is_empty() {
        if let Some(first) = groups.first() {
            primary_group = first.clone();
        }
    }

    // primary 가 groups 에 없으면 앞에 넣어 일관성 유지
    if !primary_group.is_empty() && !groups.iter().any(|g| g == &primary_group) {
        groups.insert(0, primary_group.clone());
    }

    Ok(RemotePermissionOverview {
        username,
        uid,
        primary_group,
        groups,
        home,
        is_root,
        sudo,
        docker_access,
        can_write_home,
    })
}

#[cfg(test)]
mod tests {
    use super::{parse_permission_overview, SudoAccess};

    #[test]
    fn parses_permission_overview() {
        let sample = "user\tubuntu\n\
uid\t1000\n\
primaryGroup\tubuntu\n\
groups\tubuntu docker sudo\n\
home\t/home/ubuntu\n\
isRoot\t0\n\
sudo\tpasswordless\n\
dockerAccess\t1\n\
canWriteHome\t1\n";
        let parsed = parse_permission_overview(sample).unwrap();
        assert_eq!(parsed.username, "ubuntu");
        assert_eq!(parsed.uid, 1000);
        assert_eq!(parsed.primary_group, "ubuntu");
        assert_eq!(parsed.groups, vec!["ubuntu", "docker", "sudo"]);
        assert_eq!(parsed.home, "/home/ubuntu");
        assert!(!parsed.is_root);
        assert_eq!(parsed.sudo, SudoAccess::Passwordless);
        assert!(parsed.docker_access);
        assert!(parsed.can_write_home);
    }

    #[test]
    fn maps_numeric_gid_zero_to_root() {
        let sample = "user\troot\n\
uid\t0\n\
primaryGroup\t0\n\
groups\t0\n\
home\t/root\n\
isRoot\t1\n\
sudo\troot\n\
dockerAccess\t1\n\
canWriteHome\t1\n";
        let parsed = parse_permission_overview(sample).unwrap();
        assert_eq!(parsed.primary_group, "root");
        assert_eq!(parsed.groups, vec!["root"]);
    }

    #[test]
    fn empty_groups_stay_empty() {
        let sample = "user\tnobody\n\
uid\t65534\n\
primaryGroup\t\n\
groups\t\n\
home\t/nonexistent\n\
isRoot\t0\n\
sudo\tnone\n\
dockerAccess\t0\n\
canWriteHome\t0\n";
        let parsed = parse_permission_overview(sample).unwrap();
        assert!(parsed.primary_group.is_empty());
        assert!(parsed.groups.is_empty());
    }
}
