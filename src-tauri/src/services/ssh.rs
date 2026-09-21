use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use ssh2::{Channel, Session};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_SSH_PORT: u16 = 22;
const CONNECT_TIMEOUT_SECS: u64 = 15;
const SHELL_POLL_INTERVAL_MS: u64 = 16;
const SHELL_READ_BUF_SIZE: usize = 8192;

static NEXT_SHELL_ID: AtomicU64 = AtomicU64::new(1);
static SHELL_READER_STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshTerminalDataEvent {
    shell_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshTerminalClosedEvent {
    shell_id: String,
}

#[allow(dead_code)]
pub struct ActiveConnection {
    pub host: String,
    pub username: String,
    pub port: u16,
    pub auth_method: String,
    /// Kept alive for future remote operations after login.
    pub session: Session,
    shells: HashMap<String, Channel>,
    cached_identity: Mutex<Option<super::remote_fs::RemoteIdentity>>,
}

pub struct SshConnectionManager {
    connection: Mutex<Option<ActiveConnection>>,
}

impl SshConnectionManager {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
        }
    }

    pub fn connect(
        &self,
        host: &str,
        username: &str,
        port: Option<u16>,
        auth_method: &str,
        private_key_path: Option<&str>,
        key_passphrase: Option<&str>,
        password: Option<&str>,
    ) -> Result<(String, String, u16, String), String> {
        let host = host.trim();
        let username = username.trim();
        let port = port.unwrap_or(DEFAULT_SSH_PORT);

        if host.is_empty() {
            return Err("IP 주소를 입력해 주세요.".to_string());
        }

        if username.is_empty() {
            return Err("아이디를 입력해 주세요.".to_string());
        }

        let session = match auth_method {
            "pem" => {
                let key_path = private_key_path.unwrap_or("").trim();
                if key_path.is_empty() {
                    return Err("PEM 키 파일을 선택해 주세요.".to_string());
                }
                if !Path::new(key_path).is_file() {
                    return Err(format!(
                        "키 파일을 찾을 수 없습니다: {key_path}\n터미널에서 사용하는 .pem 경로와 동일한지 확인하세요."
                    ));
                }
                open_ssh_session_with_key(host, port, username, key_path, key_passphrase)?
            }
            "password" => {
                let password = password.unwrap_or("");
                if password.is_empty() {
                    return Err("비밀번호를 입력해 주세요.".to_string());
                }
                open_ssh_session_with_password(host, port, username, password)?
            }
            _ => return Err("지원하지 않는 인증 방식입니다.".to_string()),
        };

        let auth_method = auth_method.to_string();

        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        *guard = Some(ActiveConnection {
            host: host.to_string(),
            username: username.to_string(),
            port,
            auth_method: auth_method.clone(),
            session,
            shells: HashMap::new(),
            cached_identity: Mutex::new(None),
        });

        Ok((
            host.to_string(),
            username.to_string(),
            port,
            auth_method,
        ))
    }

    pub fn disconnect(&self) -> Result<(), String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        if let Some(connection) = guard.as_mut() {
            connection.shells.clear();
        }

        *guard = None;
        Ok(())
    }

    pub fn open_shell(&self, cols: u32, rows: u32, app: &AppHandle) -> Result<String, String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_mut()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        let cols = cols.max(1);
        let rows = rows.max(1);

        let mut channel = connection
            .session
            .channel_session()
            .map_err(|error| format!("터미널 채널을 열지 못했습니다: {error}"))?;

        channel
            .request_pty("xterm-256color", None, Some((cols, rows, 0, 0)))
            .map_err(|error| format!("PTY 요청에 실패했습니다: {error}"))?;

        channel
            .shell()
            .map_err(|error| format!("원격 셸을 시작하지 못했습니다: {error}"))?;

        let shell_id = format!("shell-{}", NEXT_SHELL_ID.fetch_add(1, Ordering::SeqCst));
        connection.shells.insert(shell_id.clone(), channel);

        ensure_shell_reader(app.clone());

        Ok(shell_id)
    }

    pub fn write_shell(&self, shell_id: &str, data: &str) -> Result<(), String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_mut()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        let channel = connection
            .shells
            .get_mut(shell_id)
            .ok_or_else(|| "터미널 세션을 찾을 수 없습니다.".to_string())?;

        channel
            .write_all(data.as_bytes())
            .map_err(|error| format!("터미널 입력 전송에 실패했습니다: {error}"))?;
        channel
            .flush()
            .map_err(|error| format!("터미널 입력 플러시에 실패했습니다: {error}"))?;

        Ok(())
    }

    pub fn resize_shell(&self, shell_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_mut()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        let channel = connection
            .shells
            .get_mut(shell_id)
            .ok_or_else(|| "터미널 세션을 찾을 수 없습니다.".to_string())?;

        let cols = cols.max(1);
        let rows = rows.max(1);

        channel
            .request_pty_size(cols, rows, Some(0), Some(0))
            .map_err(|error| format!("터미널 크기 변경에 실패했습니다: {error}"))?;

        Ok(())
    }

    pub fn close_shell(&self, shell_id: &str) -> Result<(), String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_mut()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        if let Some(mut channel) = connection.shells.remove(shell_id) {
            let _ = channel.close();
            let _ = channel.wait_close();
        }

        Ok(())
    }

    pub fn close_all_shells(&self) -> Result<(), String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let Some(connection) = guard.as_mut() else {
            return Ok(());
        };

        let shell_ids: Vec<String> = connection.shells.keys().cloned().collect();
        for shell_id in shell_ids {
            if let Some(mut channel) = connection.shells.remove(&shell_id) {
                let _ = channel.close();
                let _ = channel.wait_close();
            }
        }

        Ok(())
    }

    pub fn poll_shells(&self, app: &AppHandle) -> Result<(), String> {
        let mut guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let Some(connection) = guard.as_mut() else {
            return Ok(());
        };

        if connection.shells.is_empty() {
            return Ok(());
        }

        connection.session.set_blocking(false);

        let mut outputs: Vec<(String, String)> = Vec::new();
        let mut closed: Vec<String> = Vec::new();
        let shell_ids: Vec<String> = connection.shells.keys().cloned().collect();

        for shell_id in shell_ids {
            let Some(channel) = connection.shells.get_mut(&shell_id) else {
                continue;
            };

            let mut chunk = String::new();
            let mut buf = [0u8; SHELL_READ_BUF_SIZE];

            loop {
                match channel.read(&mut buf) {
                    Ok(0) => {
                        if channel.eof() {
                            closed.push(shell_id.clone());
                        }
                        break;
                    }
                    Ok(n) => {
                        chunk.push_str(&String::from_utf8_lossy(&buf[..n]));
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => break,
                    Err(error) if error.kind() == std::io::ErrorKind::TimedOut => break,
                    Err(_) => {
                        closed.push(shell_id.clone());
                        break;
                    }
                }
            }

            // stderr stream (may also carry PTY output on some servers)
            loop {
                match channel.stderr().read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        chunk.push_str(&String::from_utf8_lossy(&buf[..n]));
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => break,
                    Err(error) if error.kind() == std::io::ErrorKind::TimedOut => break,
                    Err(_) => break,
                }
            }

            if !chunk.is_empty() {
                outputs.push((shell_id, chunk));
            }
        }

        connection.session.set_blocking(true);

        for shell_id in &closed {
            if let Some(mut channel) = connection.shells.remove(shell_id) {
                let _ = channel.close();
                let _ = channel.wait_close();
            }
        }

        drop(guard);

        for (shell_id, data) in outputs {
            let _ = app.emit(
                "ssh-terminal-data",
                SshTerminalDataEvent { shell_id, data },
            );
        }

        for shell_id in closed {
            let _ = app.emit(
                "ssh-terminal-closed",
                SshTerminalClosedEvent { shell_id },
            );
        }

        Ok(())
    }

    pub fn get_home_directory(&self) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_fs::resolve_home_directory(&connection.session, &connection.username)
    }

    pub fn list_directory(&self, path: &str) -> Result<super::remote_fs::RemoteDirectoryListing, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        let identity = {
            let mut cache = connection
                .cached_identity
                .lock()
                .map_err(|_| "원격 사용자 정보 잠금에 실패했습니다.".to_string())?;

            if cache.is_none() {
                *cache = Some(super::remote_fs::resolve_remote_identity(
                    &connection.session,
                )?);
            }

            cache
                .clone()
                .ok_or_else(|| "원격 사용자 정보를 불러오지 못했습니다.".to_string())?
        };

        super::remote_fs::list_directory(&connection.session, path, &identity)
    }

    pub fn create_directory(&self, path: &str) -> Result<(), String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_fs::create_directory(&connection.session, path)
    }

    pub fn create_file(&self, path: &str) -> Result<(), String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_fs::create_file(&connection.session, path)
    }

    pub fn delete_path(&self, path: &str) -> Result<(), String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_fs::delete_path(&connection.session, path)
    }

    pub fn read_file(&self, path: &str) -> Result<super::remote_fs::RemoteFileContent, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_fs::read_file(&connection.session, path)
    }

    pub fn write_file(&self, path: &str, content: &str) -> Result<(), String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_fs::write_file(&connection.session, path, content)
    }

    pub fn is_docker_installed(&self) -> Result<bool, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::is_docker_installed(&connection.session)
    }

    pub fn list_docker_containers(&self) -> Result<Vec<super::remote_docker::DockerContainer>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::list_containers(&connection.session)
    }

    pub fn list_docker_images(&self) -> Result<Vec<super::remote_docker::DockerImage>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::list_images(&connection.session)
    }

    pub fn list_docker_networks(&self) -> Result<Vec<super::remote_docker::DockerNetwork>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::list_networks(&connection.session)
    }

    pub fn list_docker_volumes(&self) -> Result<Vec<super::remote_docker::DockerVolume>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::list_volumes(&connection.session)
    }

    pub fn get_docker_overview(&self) -> Result<super::remote_docker::DockerOverview, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::get_docker_overview(&connection.session)
    }

    pub fn docker_container_action(
        &self,
        container_id: &str,
        action: &str,
    ) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::container_action(&connection.session, container_id, action)
    }

    pub fn docker_image_action(
        &self,
        image_ref: &str,
        action: &str,
    ) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::image_action(&connection.session, image_ref, action)
    }

    pub fn docker_volume_action(
        &self,
        volume_name: &str,
        action: &str,
    ) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::volume_action(&connection.session, volume_name, action)
    }

    pub fn docker_network_action(
        &self,
        network_ref: &str,
        action: &str,
    ) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::network_action(&connection.session, network_ref, action)
    }

    pub fn docker_system_action(&self, action: &str) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::system_action(&connection.session, action)
    }

    pub fn docker_container_details(
        &self,
        container_id: &str,
    ) -> Result<super::remote_docker::DockerContainerDetails, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::container_details(&connection.session, container_id)
    }

    pub fn docker_container_logs(
        &self,
        container_id: &str,
        tail: u32,
        since: &str,
    ) -> Result<String, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_docker::container_logs(&connection.session, container_id, tail, since)
    }

    pub fn get_disk_overview(&self) -> Result<super::remote_disk::DiskOverview, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_disk::get_disk_overview(&connection.session)
    }

    pub fn get_large_directories(
        &self,
    ) -> Result<Vec<super::remote_disk::LargeDirectory>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_disk::get_large_directories(&connection.session)
    }

    pub fn get_system_resources(&self) -> Result<super::remote_system::SystemResources, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_system::get_system_resources(&connection.session)
    }

    pub fn list_ssh_sessions(&self) -> Result<Vec<super::remote_ssh_sessions::RemoteSshSession>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_ssh_sessions::list_ssh_sessions(&connection.session)
    }

    pub fn get_permission_overview(
        &self,
    ) -> Result<super::remote_permissions::RemotePermissionOverview, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_permissions::get_permission_overview(&connection.session)
    }

    pub fn ensure_disk_history_collector(&self) -> Result<(), String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_disk_history::ensure_disk_history_collector(
            &connection.session,
            &connection.username,
        )
    }

    pub fn get_disk_history(
        &self,
    ) -> Result<Vec<super::remote_disk_history::DiskUsageSample>, String> {
        let guard = self
            .connection
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let connection = guard
            .as_ref()
            .ok_or_else(|| "SSH 호스트에 연결되어 있지 않습니다.".to_string())?;

        super::remote_disk_history::read_disk_history(
            &connection.session,
            &connection.username,
        )
    }
}

fn connect_tcp(host: &str, port: u16) -> Result<TcpStream, String> {
    let addr = (host, port)
        .to_socket_addrs()
        .map_err(|error| format!("주소를 해석할 수 없습니다: {error}"))?
        .next()
        .ok_or_else(|| format!("유효한 주소를 찾을 수 없습니다: {host}:{port}"))?;

    let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .map_err(|error| {
            format!(
                "서버({host}:{port})에 연결할 수 없습니다: {error}\n보안 그룹에서 SSH({port})와 현재 IP가 허용되어 있는지 확인하세요."
            )
        })?;

    tcp.set_read_timeout(Some(Duration::from_secs(CONNECT_TIMEOUT_SECS)))
        .map_err(|error| error.to_string())?;
    tcp.set_write_timeout(Some(Duration::from_secs(CONNECT_TIMEOUT_SECS)))
        .map_err(|error| error.to_string())?;

    Ok(tcp)
}

fn handshake_session(tcp: TcpStream) -> Result<Session, String> {
    let mut session = Session::new().map_err(|error| error.to_string())?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|error| format!("SSH 핸드셰이크에 실패했습니다: {error}"))?;
    Ok(session)
}

fn open_ssh_session_with_key(
    host: &str,
    port: u16,
    username: &str,
    private_key_path: &str,
    passphrase: Option<&str>,
) -> Result<Session, String> {
    let session = handshake_session(connect_tcp(host, port)?)?;
    session
        .userauth_pubkey_file(
            username,
            None,
            Path::new(private_key_path),
            passphrase,
        )
        .map_err(|error| {
            format!(
                "PEM 키 인증에 실패했습니다: {error}\n아이디, IP, 포트, 키 파일이 ssh -i 키 -p 포트 아이디@IP 와 동일한지 확인하세요."
            )
        })?;

    ensure_authenticated(&session)?;
    Ok(session)
}

fn open_ssh_session_with_password(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
) -> Result<Session, String> {
    let session = handshake_session(connect_tcp(host, port)?)?;
    session.userauth_password(username, password).map_err(|error| {
        format!(
            "비밀번호 인증에 실패했습니다: {error}\n아이디·비밀번호·포트를 확인하세요. 키 인증만 허용하는 호스트가 많습니다."
        )
    })?;

    ensure_authenticated(&session)?;
    Ok(session)
}

fn ensure_authenticated(session: &Session) -> Result<(), String> {
    if !session.authenticated() {
        return Err("SSH 인증에 실패했습니다.".to_string());
    }
    Ok(())
}

fn ensure_shell_reader(app: AppHandle) {
    if SHELL_READER_STARTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(SHELL_POLL_INTERVAL_MS));

            let Some(manager) = app.try_state::<SshConnectionManager>() else {
                continue;
            };

            let _ = manager.poll_shells(&app);
        }
    });
}
