use serde::{Deserialize, Serialize};
use ssh2::Session;

use super::remote_fs::{exec_remote_command, exec_remote_command_checked};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainer {
    pub id: String,
    pub image: String,
    pub status: String,
    pub names: String,
    pub ports: String,
}

#[derive(Deserialize)]
struct DockerPsRow {
    #[serde(rename = "ID")]
    id: String,
    #[serde(rename = "Image")]
    image: String,
    #[serde(rename = "Status")]
    status: String,
    #[serde(rename = "Names")]
    names: String,
    #[serde(rename = "Ports")]
    ports: Option<String>,
}

pub fn is_docker_installed(session: &Session) -> Result<bool, String> {
    let output = exec_remote_command(session, "command -v docker 2>/dev/null")?;
    Ok(!output.trim().is_empty())
}

pub fn list_containers(session: &Session) -> Result<Vec<DockerContainer>, String> {
    let output = exec_remote_command(
        session,
        "docker ps -a --format '{{json .}}' 2>&1",
    )?;

    if output.contains("Cannot connect to the Docker daemon") {
        return Err(
            "Docker 데몬에 연결할 수 없습니다. 원격 서버에서 Docker 서비스가 실행 중인지 확인하세요."
                .to_string(),
        );
    }

    if output.contains("permission denied") && output.contains("docker.sock") {
        return Err(
            "Docker 소켓 접근 권한이 없습니다. 사용자를 docker 그룹에 추가했는지 확인하세요."
                .to_string(),
        );
    }

    if output.trim().is_empty() {
        return Ok(Vec::new());
    }

    if output.starts_with("Error") || output.starts_with("error") {
        return Err(output);
    }

    let mut containers = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let row: DockerPsRow = serde_json::from_str(trimmed).map_err(|error| {
            format!("docker container list parsing failed: {error}\n{trimmed}")
        })?;

        containers.push(DockerContainer {
            id: row.id,
            image: row.image,
            status: row.status,
            names: row.names,
            ports: row.ports.unwrap_or_default(),
        });
    }

    Ok(containers)
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn validate_container_id(container_id: &str) -> Result<&str, String> {
    let id = container_id.trim();
    if id.is_empty() || id.contains('\n') || id.contains('\r') {
        return Err("올바르지 않은 컨테이너 ID입니다.".to_string());
    }
    Ok(id)
}

fn try_command(session: &Session, command: &str) -> Option<String> {
    match exec_remote_command_checked(session, command) {
        Ok(output) if !output.trim().is_empty() => Some(output),
        _ => None,
    }
}

fn json_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

fn join_json_array(value: &serde_json::Value, separator: &str) -> String {
    match value.as_array() {
        Some(items) if !items.is_empty() => items
            .iter()
            .map(json_string)
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>()
            .join(separator),
        _ => String::new(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerDetails {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub created: String,
    pub platform: String,
    pub restart_policy: String,
    pub ip_address: String,
    pub mac_address: String,
    pub networks: String,
    pub mounts: String,
    pub env: String,
    pub cmd: String,
    pub entrypoint: String,
    pub working_dir: String,
    pub ports: String,
    pub labels: String,
    pub stats: Option<String>,
    pub top: Option<String>,
    pub logs: Option<String>,
    pub inspect_json: String,
}

pub fn container_details(
    session: &Session,
    container_id: &str,
) -> Result<DockerContainerDetails, String> {
    let id = validate_container_id(container_id)?;
    let quoted = shell_quote(id);

    let inspect_raw =
        exec_remote_command_checked(session, &format!("docker inspect -- {quoted} 2>&1"))?;
    let inspect_value: serde_json::Value = serde_json::from_str(&inspect_raw)
        .map_err(|error| format!("docker inspect 파싱 실패: {error}"))?;
    let container = inspect_value
        .as_array()
        .and_then(|items| items.first())
        .ok_or_else(|| "docker inspect 결과가 비어 있습니다.".to_string())?;

    let state = &container["State"];
    let config = &container["Config"];
    let network_settings = &container["NetworkSettings"];
    let host_config = &container["HostConfig"];

    let name = json_string(&container["Name"]).trim_start_matches('/').to_string();
    let status = [
        json_string(&state["Status"]),
        json_string(&state["Error"]),
    ]
    .into_iter()
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join(" · ");

    let restart_policy = {
        let name = json_string(&host_config["RestartPolicy"]["Name"]);
        let retries = host_config["RestartPolicy"]["MaximumRetryCount"]
            .as_i64()
            .unwrap_or(0);
        if name.is_empty() {
            String::new()
        } else if retries > 0 {
            format!("{name} (max {retries})")
        } else {
            name
        }
    };

    let networks = match network_settings["Networks"].as_object() {
        Some(map) if !map.is_empty() => map
            .iter()
            .map(|(network_name, network)| {
                let ip = json_string(&network["IPAddress"]);
                if ip.is_empty() {
                    network_name.clone()
                } else {
                    format!("{network_name}: {ip}")
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    };

    let mounts = match container["Mounts"].as_array() {
        Some(items) if !items.is_empty() => items
            .iter()
            .map(|mount| {
                let source = json_string(&mount["Source"]);
                let destination = json_string(&mount["Destination"]);
                let mode = json_string(&mount["Mode"]);
                if mode.is_empty() {
                    format!("{source} → {destination}")
                } else {
                    format!("{source} → {destination} ({mode})")
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    };

    let labels = match config["Labels"].as_object() {
        Some(map) if !map.is_empty() => map
            .iter()
            .map(|(key, value)| format!("{key}={}", json_string(value)))
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    };

    let ports = try_command(session, &format!("docker port -- {quoted} 2>&1"))
        .unwrap_or_else(|| json_string(&network_settings["Ports"]));

    let stats = try_command(
        session,
        &format!(
            "docker stats --no-stream --format 'table {{{{.Name}}}}\\t{{{{.CPUPerc}}}}\\t{{{{.MemUsage}}}}\\t{{{{.NetIO}}}}\\t{{{{.BlockIO}}}}\\t{{{{.PIDs}}}}' -- {quoted} 2>&1"
        ),
    );
    let top = try_command(session, &format!("docker top -- {quoted} 2>&1"));

    let inspect_json = serde_json::to_string_pretty(container)
        .unwrap_or_else(|_| inspect_raw.clone());

    Ok(DockerContainerDetails {
        id: json_string(&container["Id"]),
        name,
        image: json_string(&config["Image"]),
        status: if status.is_empty() {
            json_string(&state["Status"])
        } else {
            status
        },
        created: json_string(&container["Created"]),
        platform: json_string(&container["Platform"]),
        restart_policy,
        ip_address: json_string(&network_settings["IPAddress"]),
        mac_address: json_string(&network_settings["MacAddress"]),
        networks,
        mounts,
        env: join_json_array(&config["Env"], "\n"),
        cmd: join_json_array(&config["Cmd"], " "),
        entrypoint: join_json_array(&config["Entrypoint"], " "),
        working_dir: json_string(&config["WorkingDir"]),
        ports,
        labels,
        stats,
        top,
        // 로그는 개수·시간대 필터가 있어 별도 커맨드로 조회한다.
        logs: None,
        inspect_json,
    })
}

fn validate_logs_tail(tail: u32) -> Result<u32, String> {
    if !(1..=5_000).contains(&tail) {
        return Err("로그 개수는 1~5000 사이여야 합니다.".to_string());
    }
    Ok(tail)
}

fn validate_logs_since(since: &str) -> Result<Option<String>, String> {
    let trimmed = since.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let is_relative = trimmed.len() <= 16
        && trimmed
            .chars()
            .all(|ch| ch.is_ascii_digit() || matches!(ch, 's' | 'm' | 'h'));
    let is_timestamp = trimmed.len() <= 40
        && trimmed.chars().all(|ch| {
            ch.is_ascii_alphanumeric() || matches!(ch, '-' | ':' | '.' | '+' | 'T' | 'Z')
        });

    if !is_relative && !is_timestamp {
        return Err(
            "시간대는 상대 시간(예: 1h, 30m) 또는 RFC3339 형식이어야 합니다.".to_string(),
        );
    }

    // 상대 시간은 숫자+단위가 한 번만 있어야 한다 (예: 1h, 30m).
    if is_relative {
        let (digits, unit) = trimmed.split_at(trimmed.len().saturating_sub(1));
        if digits.is_empty() || !digits.chars().all(|ch| ch.is_ascii_digit()) {
            return Err("상대 시간 형식이 올바르지 않습니다. 예: 1h, 30m".to_string());
        }
        if !matches!(unit, "s" | "m" | "h") {
            return Err("상대 시간 단위는 s, m, h만 사용할 수 있습니다.".to_string());
        }
    }

    Ok(Some(trimmed.to_string()))
}

pub fn container_logs(
    session: &Session,
    container_id: &str,
    tail: u32,
    since: &str,
) -> Result<String, String> {
    let id = validate_container_id(container_id)?;
    let tail = validate_logs_tail(tail)?;
    let since = validate_logs_since(since)?;
    let quoted = shell_quote(id);

    let mut command = format!("docker logs --tail {tail} --timestamps");
    if let Some(since_value) = since {
        command.push_str(&format!(" --since {}", shell_quote(&since_value)));
    }
    command.push_str(&format!(" -- {quoted} 2>&1"));

    exec_remote_command_checked(session, &command)
}

pub fn container_action(
    session: &Session,
    container_id: &str,
    action: &str,
) -> Result<String, String> {
    let id = validate_container_id(container_id)?;
    let quoted = shell_quote(id);
    let command = match action {
        "start" => format!("docker start -- {quoted} 2>&1"),
        "stop" => format!("docker stop -- {quoted} 2>&1"),
        "restart" => format!("docker restart -- {quoted} 2>&1"),
        "kill" => format!("docker kill -- {quoted} 2>&1"),
        "pause" => format!("docker pause -- {quoted} 2>&1"),
        "unpause" => format!("docker unpause -- {quoted} 2>&1"),
        "remove" => format!("docker rm -- {quoted} 2>&1"),
        "force-remove" => format!("docker rm -f -- {quoted} 2>&1"),
        "nginx-test" => format!("docker exec -- {quoted} nginx -t 2>&1"),
        "nginx-reload" => format!("docker exec -- {quoted} nginx -s reload 2>&1"),
        "nginx-quit" => format!("docker exec -- {quoted} nginx -s quit 2>&1"),
        "nginx-version" => format!("docker exec -- {quoted} nginx -v 2>&1"),
        _ => return Err("지원하지 않는 Docker 동작입니다.".to_string()),
    };

    exec_remote_command_checked(session, &command)
}
