use serde::Serialize;
use ssh2::Session;

use super::remote_fs::exec_remote_command;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSshSession {
    pub user: String,
    pub tty: String,
    pub from: String,
    pub login_at: String,
    pub idle: String,
}

/// 원격 로그인 세션 (`who` / `who -u`). 로컬 터미널 탭과 별개.
pub fn list_ssh_sessions(session: &Session) -> Result<Vec<RemoteSshSession>, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e
# who -u: USER TTY LOGIN IDLE PID COMMENT
# who:    USER TTY LOGIN (FROM)
if who -u >/dev/null 2>&1; then
  who -u 2>/dev/null
else
  who 2>/dev/null
fi | awk '
NF < 2 { next }
{
  user=$1
  tty=$2
  from="local"
  idle="—"
  login=""

  if (match($0, /\(([^)]*)\)/)) {
    from=substr($0, RSTART+1, RLENGTH-2)
    line=substr($0, 1, RSTART-1)
  } else {
    line=$0
  }
  n=split(line, a, /[ \t]+/)
  # a[1]=user a[2]=tty; remaining until idle/pid are login time
  login_start=3
  login_end=n
  for (i=3; i<=n; i++) {
    if (a[i]=="." || a[i]=="old" || a[i] ~ /^[0-9]+:[0-9]+$/ || a[i] ~ /^[0-9]+days?$/ || a[i] ~ /^[0-9]+d$/) {
      idle=a[i]
      login_end=i-1
      break
    }
    # numeric PID after idle on who -u
    if (a[i] ~ /^[0-9]+$/ && i>4) {
      login_end=i-1
      break
    }
  }
  for (i=login_start; i<=login_end; i++) {
    if (login != "") login=login " "
    login=login a[i]
  }
  if (login == "") login="—"
  printf "session\t%s\t%s\t%s\t%s\t%s\n", user, tty, from, login, idle
}
'
"#,
    )?;

    parse_ssh_sessions(&output)
}

fn parse_ssh_sessions(output: &str) -> Result<Vec<RemoteSshSession>, String> {
    let mut sessions = Vec::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 6 || parts[0] != "session" {
            continue;
        }

        let user = parts[1].trim();
        if user.is_empty() {
            continue;
        }

        sessions.push(RemoteSshSession {
            user: user.to_string(),
            tty: parts[2].trim().to_string(),
            from: {
                let from = parts[3].trim();
                if from.is_empty() {
                    "local".to_string()
                } else {
                    from.to_string()
                }
            },
            login_at: {
                let login = parts[4].trim();
                if login.is_empty() {
                    "—".to_string()
                } else {
                    login.to_string()
                }
            },
            idle: {
                let idle = parts[5].trim();
                if idle.is_empty() {
                    "—".to_string()
                } else {
                    idle.to_string()
                }
            },
        });
    }

    Ok(sessions)
}

#[cfg(test)]
mod tests {
    use super::parse_ssh_sessions;

    #[test]
    fn parses_session_lines() {
        let sample = "session\tubuntu\tpts/0\t172.30.12.41\t2024-03-15 10:22\t.\n\
session\tdeploy\tpts/1\trunner\tMar 15 09:00\told\n";
        let parsed = parse_ssh_sessions(sample).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].user, "ubuntu");
        assert_eq!(parsed[0].from, "172.30.12.41");
        assert_eq!(parsed[1].idle, "old");
    }
}
