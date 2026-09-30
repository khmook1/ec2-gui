use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use socket2::{SockRef, TcpKeepalive};
use ssh2::{Channel, Session};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_SSH_PORT: u16 = 22;
const CONNECT_TIMEOUT_SECS: u64 = 15;
const SHELL_POLL_INTERVAL_MS: u64 = 16;
const SHELL_READ_BUF_SIZE: usize = 8192;
/// Idle 후 SSH keepalive 전송 주기(초). NAT/방화벽 idle drop 방지.
const SSH_KEEPALIVE_INTERVAL_SECS: u32 = 10;
/// 백그라운드 keepalive 점검 최소 간격.
const KEEPALIVE_TICK_INTERVAL: Duration = Duration::from_secs(5);
const TCP_KEEPALIVE_TIME: Duration = Duration::from_secs(30);
const TCP_KEEPALIVE_INTERVAL: Duration = Duration::from_secs(10);

static NEXT_SHELL_ID: AtomicU64 = AtomicU64::new(1);
static NEXT_CONNECTION_ID: AtomicU64 = AtomicU64::new(1);
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SshSessionReconnectedEvent {
    host: String,
    username: String,
}

#[derive(Clone)]
enum StoredAuth {
    Pem {
        private_key_path: String,
        key_passphrase: Option<String>,
    },
    Password {
        password: String,
    },
}

#[allow(dead_code)]
pub struct ActiveConnection {
    pub host: String,
    pub username: String,
    pub port: u16,
    pub auth_method: String,
    /// Kept alive for future remote operations after login.
    pub session: Session,
    auth: StoredAuth,
    shells: HashMap<String, Channel>,
    cached_identity: Mutex<Option<super::remote_fs::RemoteIdentity>>,
    cached_os: Mutex<Option<String>>,
    cached_home: Mutex<Option<String>>,
}

impl ActiveConnection {
    /// `uname -s`는 연결당 한 번만 실행한다. 감지 실패(`unknown`)는 캐시하지 않는다.
    fn remote_os(&self) -> String {
        if let Ok(cache) = self.cached_os.lock() {
            if let Some(os) = cache.as_ref() {
                return os.clone();
            }
        }

        let os = super::remote_disk::detect_remote_os(&self.session);
        if os != "unknown" {
            if let Ok(mut cache) = self.cached_os.lock() {
                *cache = Some(os.clone());
            }
        }
        os
    }

    fn home_dir(&self) -> Result<String, String> {
        let mut cache = self
            .cached_home
            .lock()
            .map_err(|_| "원격 홈 디렉터리 잠금에 실패했습니다.".to_string())?;

        if let Some(home) = cache.as_ref() {
            return Ok(home.clone());
        }

        let home = super::remote_fs::resolve_home_directory(&self.session, &self.username)?;
        *cache = Some(home.clone());
        Ok(home)
    }

    fn server_key(&self) -> String {
        format!("{}@{}:{}", self.username, self.host, self.port)
    }

    fn clear_caches(&self) {
        if let Ok(mut cache) = self.cached_identity.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.cached_os.lock() {
            *cache = None;
        }
        if let Ok(mut cache) = self.cached_home.lock() {
            *cache = None;
        }
    }
}

fn favorites_target<'a>(
    file: &'a Path,
    server_key: &'a str,
    connection: &'a ActiveConnection,
    home: &'a str,
) -> super::local_favorites::FavoritesTarget<'a> {
    super::local_favorites::FavoritesTarget {
        file,
        server_key,
        session: &connection.session,
        home,
    }
}

pub struct SshConnectionManager {
    connections: Mutex<HashMap<String, ActiveConnection>>,
    active_id: Mutex<Option<String>>,
    app: Mutex<Option<AppHandle>>,
    last_keepalive_tick: Mutex<Option<Instant>>,
    /// 수동 disconnect 중(연결 0개)이면 자동 재접속하지 않음.
    reconnect_enabled: AtomicBool,
}

impl SshConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
            active_id: Mutex::new(None),
            app: Mutex::new(None),
            last_keepalive_tick: Mutex::new(None),
            reconnect_enabled: AtomicBool::new(false),
        }
    }

    pub fn bind_app(&self, app: AppHandle) {
        if let Ok(mut guard) = self.app.lock() {
            *guard = Some(app);
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
    ) -> Result<(String, String, String, u16, String), String> {
        let host = host.trim();
        let username = username.trim();
        let port = port.unwrap_or(DEFAULT_SSH_PORT);

        if host.is_empty() {
            return Err("IP 주소를 입력해 주세요.".to_string());
        }

        if username.is_empty() {
            return Err("아이디를 입력해 주세요.".to_string());
        }

        let (session, auth) = match auth_method {
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
                let session =
                    open_ssh_session_with_key(host, port, username, key_path, key_passphrase)?;
                (
                    session,
                    StoredAuth::Pem {
                        private_key_path: key_path.to_string(),
                        key_passphrase: key_passphrase.map(str::to_string),
                    },
                )
            }
            "password" => {
                let password = password.unwrap_or("");
                if password.is_empty() {
                    return Err("비밀번호를 입력해 주세요.".to_string());
                }
                let session = open_ssh_session_with_password(host, port, username, password)?;
                (
                    session,
                    StoredAuth::Password {
                        password: password.to_string(),
                    },
                )
            }
            _ => return Err("지원하지 않는 인증 방식입니다.".to_string()),
        };

        let auth_method = auth_method.to_string();
        let connection_id = format!(
            "conn-{}",
            NEXT_CONNECTION_ID.fetch_add(1, Ordering::SeqCst)
        );

        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        connections.insert(
            connection_id.clone(),
            ActiveConnection {
                host: host.to_string(),
                username: username.to_string(),
                port,
                auth_method: auth_method.clone(),
                session,
                auth,
                shells: HashMap::new(),
                cached_identity: Mutex::new(None),
                cached_os: Mutex::new(None),
                cached_home: Mutex::new(None),
            },
        );
        drop(connections);

        {
            let mut active = self
                .active_id
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
            *active = Some(connection_id.clone());
        }

        self.reconnect_enabled.store(true, Ordering::SeqCst);
        if let Ok(mut tick) = self.last_keepalive_tick.lock() {
            *tick = Some(Instant::now());
        }

        if let Ok(app_guard) = self.app.lock() {
            if let Some(app) = app_guard.as_ref() {
                ensure_shell_reader(app.clone());
            }
        }

        Ok((
            connection_id,
            host.to_string(),
            username.to_string(),
            port,
            auth_method,
        ))
    }

    /// 활성 세션만 종료. 남은 세션이 있으면 그중 하나로 active를 옮긴다.
    pub fn disconnect(&self) -> Result<(), String> {
        let active_id = {
            let active = self
                .active_id
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
            active.clone()
        };

        let Some(id) = active_id else {
            return Ok(());
        };

        self.disconnect_session(&id)
    }

    pub fn disconnect_session(&self, connection_id: &str) -> Result<(), String> {
        let (closed_shells, next_active, empty) = {
            let mut connections = self
                .connections
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

            let Some(mut connection) = connections.remove(connection_id) else {
                return Ok(());
            };

            let shell_ids: Vec<String> = connection.shells.keys().cloned().collect();
            for shell_id in &shell_ids {
                if let Some(mut channel) = connection.shells.remove(shell_id) {
                    let _ = channel.close();
                    let _ = channel.wait_close();
                }
            }

            let next_active = connections.keys().next().cloned();
            let empty = connections.is_empty();
            (shell_ids, next_active, empty)
        };

        {
            let mut active = self
                .active_id
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
            if active.as_deref() == Some(connection_id) {
                *active = next_active;
            }
        }

        if empty {
            self.reconnect_enabled.store(false, Ordering::SeqCst);
        }

        if let Ok(app_guard) = self.app.lock() {
            if let Some(app) = app_guard.as_ref() {
                for shell_id in closed_shells {
                    let _ = app.emit(
                        "ssh-terminal-closed",
                        SshTerminalClosedEvent { shell_id },
                    );
                }
            }
        }

        Ok(())
    }

    pub fn set_active_session(&self, connection_id: &str) -> Result<(), String> {
        let connections = self
            .connections
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        if !connections.contains_key(connection_id) {
            return Err("해당 SSH 세션을 찾을 수 없습니다.".to_string());
        }

        let mut active = self
            .active_id
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
        *active = Some(connection_id.to_string());
        Ok(())
    }

    pub fn active_session_id(&self) -> Result<Option<String>, String> {
        let active = self
            .active_id
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
        Ok(active.clone())
    }

    /// 세션이 끊겼으면 즉시 재접속한 뒤 작업을 수행한다. 실패 시 1회 재시도.
    fn with_connection<R>(
        &self,
        mut op: impl FnMut(&ActiveConnection) -> Result<R, String>,
    ) -> Result<R, String> {
        let mut last_error = None;

        for attempt in 0..2 {
            let active_id = {
                let active = self
                    .active_id
                    .lock()
                    .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
                active.clone()
            };

            let Some(active_id) = active_id else {
                return Err("SSH 호스트에 연결되어 있지 않습니다.".to_string());
            };

            let mut connections = self
                .connections
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

            let Some(connection) = connections.get_mut(&active_id) else {
                return Err("SSH 호스트에 연결되어 있지 않습니다.".to_string());
            };

            if attempt == 0 {
                if !session_is_alive(&connection.session) {
                    self.reconnect_locked(connection)?;
                }
            } else {
                self.reconnect_locked(connection)?;
            }

            match op(connection) {
                Ok(value) => return Ok(value),
                Err(error) if attempt == 0 && looks_like_disconnect(&error) => {
                    last_error = Some(error);
                }
                Err(error) => return Err(error),
            }
        }

        Err(last_error.unwrap_or_else(|| "SSH 재접속에 실패했습니다.".to_string()))
    }

    fn reconnect_locked(&self, connection: &mut ActiveConnection) -> Result<(), String> {
        if !self.reconnect_enabled.load(Ordering::SeqCst) {
            return Err("SSH 호스트에 연결되어 있지 않습니다.".to_string());
        }

        let closed_shells: Vec<String> = connection.shells.keys().cloned().collect();
        connection.shells.clear();
        connection.clear_caches();

        let session = open_ssh_session_from_auth(
            &connection.host,
            connection.port,
            &connection.username,
            &connection.auth,
        )?;
        connection.session = session;

        let app = self
            .app
            .lock()
            .ok()
            .and_then(|guard| guard.clone());

        if let Some(app) = app {
            for shell_id in closed_shells {
                let _ = app.emit(
                    "ssh-terminal-closed",
                    SshTerminalClosedEvent { shell_id },
                );
            }
            let _ = app.emit(
                "ssh-session-reconnected",
                SshSessionReconnectedEvent {
                    host: connection.host.clone(),
                    username: connection.username.clone(),
                },
            );
        }

        Ok(())
    }

    /// 백그라운드 keepalive. 끊김 감지 시 즉시 재접속.
    pub fn tick_keepalive(&self) {
        if !self.reconnect_enabled.load(Ordering::SeqCst) {
            return;
        }

        {
            let Ok(mut last) = self.last_keepalive_tick.lock() else {
                return;
            };
            if let Some(prev) = *last {
                if prev.elapsed() < KEEPALIVE_TICK_INTERVAL {
                    return;
                }
            }
            *last = Some(Instant::now());
        }

        let Ok(mut connections) = self.connections.lock() else {
            return;
        };

        let ids: Vec<String> = connections.keys().cloned().collect();
        for id in ids {
            let Some(connection) = connections.get_mut(&id) else {
                continue;
            };
            match connection.session.keepalive_send() {
                Ok(_) => {}
                Err(_) => {
                    let _ = self.reconnect_locked(connection);
                }
            }
        }
    }

    pub fn open_shell(&self, cols: u32, rows: u32, app: &AppHandle) -> Result<String, String> {
        self.bind_app(app.clone());

        let mut last_error: Option<String> = None;
        for attempt in 0..2 {
            let active_id = {
                let active = self
                    .active_id
                    .lock()
                    .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
                active.clone()
            };

            let Some(active_id) = active_id else {
                return Err("SSH 호스트에 연결되어 있지 않습니다.".to_string());
            };

            let mut connections = self
                .connections
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

            let Some(connection) = connections.get_mut(&active_id) else {
                return Err("SSH 호스트에 연결되어 있지 않습니다.".to_string());
            };

            if attempt == 0 {
                if !session_is_alive(&connection.session) {
                    self.reconnect_locked(connection)?;
                }
            } else {
                self.reconnect_locked(connection)?;
            }

            let cols = cols.max(1);
            let rows = rows.max(1);

            let channel_result = connection.session.channel_session();
            let mut channel = match channel_result {
                Ok(channel) => channel,
                Err(error) => {
                    let message = format!("터미널 채널을 열지 못했습니다: {error}");
                    if attempt == 0 && looks_like_disconnect(&message) {
                        last_error = Some(message);
                        continue;
                    }
                    return Err(message);
                }
            };

            if let Err(error) =
                channel.request_pty("xterm-256color", None, Some((cols, rows, 0, 0)))
            {
                let message = format!("PTY 요청에 실패했습니다: {error}");
                if attempt == 0 && looks_like_disconnect(&message) {
                    last_error = Some(message);
                    continue;
                }
                return Err(message);
            }

            if let Err(error) = channel.shell() {
                let message = format!("원격 셸을 시작하지 못했습니다: {error}");
                if attempt == 0 && looks_like_disconnect(&message) {
                    last_error = Some(message);
                    continue;
                }
                return Err(message);
            }

            let shell_id = format!("shell-{}", NEXT_SHELL_ID.fetch_add(1, Ordering::SeqCst));
            connection.shells.insert(shell_id.clone(), channel);
            ensure_shell_reader(app.clone());
            return Ok(shell_id);
        }

        Err(last_error.unwrap_or_else(|| "터미널 세션을 열지 못했습니다.".to_string()))
    }

    fn with_shell_mut<R>(
        &self,
        shell_id: &str,
        mut op: impl FnMut(&mut Channel) -> Result<R, String>,
    ) -> Result<R, String> {
        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        for connection in connections.values_mut() {
            if let Some(channel) = connection.shells.get_mut(shell_id) {
                return op(channel);
            }
        }

        Err("터미널 세션을 찾을 수 없습니다.".to_string())
    }

    pub fn write_shell(&self, shell_id: &str, data: &str) -> Result<(), String> {
        self.with_shell_mut(shell_id, |channel| {
            channel
                .write_all(data.as_bytes())
                .map_err(|error| format!("터미널 입력 전송에 실패했습니다: {error}"))?;
            channel
                .flush()
                .map_err(|error| format!("터미널 입력 플러시에 실패했습니다: {error}"))?;
            Ok(())
        })
    }

    pub fn resize_shell(&self, shell_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let cols = cols.max(1);
        let rows = rows.max(1);
        self.with_shell_mut(shell_id, |channel| {
            channel
                .request_pty_size(cols, rows, Some(0), Some(0))
                .map_err(|error| format!("터미널 크기 변경에 실패했습니다: {error}"))?;
            Ok(())
        })
    }

    pub fn close_shell(&self, shell_id: &str) -> Result<(), String> {
        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        for connection in connections.values_mut() {
            if let Some(mut channel) = connection.shells.remove(shell_id) {
                let _ = channel.close();
                let _ = channel.wait_close();
                return Ok(());
            }
        }

        Ok(())
    }

    pub fn close_all_shells(&self) -> Result<(), String> {
        let active_id = {
            let active = self
                .active_id
                .lock()
                .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;
            active.clone()
        };

        let Some(active_id) = active_id else {
            return Ok(());
        };

        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        let Some(connection) = connections.get_mut(&active_id) else {
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
        let mut connections = self
            .connections
            .lock()
            .map_err(|_| "연결 상태 잠금에 실패했습니다.".to_string())?;

        if connections.is_empty() {
            return Ok(());
        }

        let mut outputs: Vec<(String, String)> = Vec::new();
        let mut closed: Vec<(String, String)> = Vec::new();

        let connection_ids: Vec<String> = connections.keys().cloned().collect();
        for connection_id in connection_ids {
            let Some(connection) = connections.get_mut(&connection_id) else {
                continue;
            };
            if connection.shells.is_empty() {
                continue;
            }

            connection.session.set_blocking(false);

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
                                closed.push((connection_id.clone(), shell_id.clone()));
                            }
                            break;
                        }
                        Ok(n) => {
                            chunk.push_str(&String::from_utf8_lossy(&buf[..n]));
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => break,
                        Err(error) if error.kind() == std::io::ErrorKind::TimedOut => break,
                        Err(_) => {
                            closed.push((connection_id.clone(), shell_id.clone()));
                            break;
                        }
                    }
                }

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
        }

        for (connection_id, shell_id) in &closed {
            if let Some(connection) = connections.get_mut(connection_id) {
                if let Some(mut channel) = connection.shells.remove(shell_id) {
                    let _ = channel.close();
                    let _ = channel.wait_close();
                }
            }
        }

        drop(connections);

        for (shell_id, data) in outputs {
            let _ = app.emit(
                "ssh-terminal-data",
                SshTerminalDataEvent { shell_id, data },
            );
        }

        for (_connection_id, shell_id) in closed {
            let _ = app.emit(
                "ssh-terminal-closed",
                SshTerminalClosedEvent { shell_id },
            );
        }

        Ok(())
    }

    pub fn get_home_directory(&self) -> Result<String, String> {
        self.with_connection(|connection| connection.home_dir())
    }

    pub fn list_directory(&self, path: &str) -> Result<super::remote_fs::RemoteDirectoryListing, String> {
        self.with_connection(|connection| {
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
        })
    }

    pub fn create_directory(&self, path: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_fs::create_directory(&connection.session, path)
        })
    }

    pub fn create_file(&self, path: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_fs::create_file(&connection.session, path)
        })
    }

    pub fn delete_path(&self, path: &str) -> Result<(), String> {
        let favorites_file = self.favorites_file().ok();
        self.with_connection(|connection| {
            super::remote_fs::delete_path(&connection.session, path)?;
            // 삭제는 이미 끝났으므로 즐겨찾기 정리 실패로 재시도(재삭제)하지 않는다.
            if let (Some(file), Ok(home)) = (favorites_file.as_deref(), connection.home_dir()) {
                let server_key = connection.server_key();
                let target = favorites_target(file, &server_key, connection, &home);
                let _ = super::local_favorites::remove_favorites_under(&target, path);
            }
            Ok(())
        })
    }

    /// 즐겨찾기는 개인 데이터라 서버가 아닌 이 컴퓨터의 앱 데이터에 서버별로 저장한다.
    fn favorites_file(&self) -> Result<PathBuf, String> {
        let app = self
            .app
            .lock()
            .map_err(|_| "앱 핸들 잠금에 실패했습니다.".to_string())?
            .clone()
            .ok_or_else(|| "앱이 아직 준비되지 않았습니다.".to_string())?;
        let paths = super::storage_service::resolve_and_ensure(&app)?;
        Ok(PathBuf::from(paths.favorites_file))
    }

    fn with_favorites<R>(
        &self,
        op: impl Fn(&super::local_favorites::FavoritesTarget) -> Result<R, String>,
    ) -> Result<R, String> {
        let file = self.favorites_file()?;
        self.with_connection(|connection| {
            let home = connection.home_dir()?;
            let server_key = connection.server_key();
            op(&favorites_target(&file, &server_key, connection, &home))
        })
    }

    pub fn list_favorites(&self) -> Result<Vec<super::remote_fs::RemoteEntry>, String> {
        self.with_favorites(super::local_favorites::list_favorites)
    }

    pub fn list_docker_favorites(&self) -> Result<Vec<String>, String> {
        self.with_favorites(super::local_favorites::list_docker_favorites)
    }

    pub fn set_docker_favorite(
        &self,
        container_name: &str,
        favorite: bool,
    ) -> Result<Vec<String>, String> {
        self.with_favorites(|target| {
            super::local_favorites::set_docker_favorite(target, container_name, favorite)
        })
    }

    pub fn set_favorite(
        &self,
        path: &str,
        favorite: bool,
    ) -> Result<Vec<super::remote_fs::RemoteEntry>, String> {
        self.with_favorites(|target| super::local_favorites::set_favorite(target, path, favorite))
    }

    pub fn read_file(&self, path: &str) -> Result<super::remote_fs::RemoteFileContent, String> {
        self.with_connection(|connection| {
            super::remote_fs::read_file(&connection.session, path)
        })
    }

    pub fn write_file(&self, path: &str, content: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_fs::write_file(&connection.session, path, content)
        })
    }

    pub fn is_docker_installed(&self) -> Result<bool, String> {
        self.with_connection(|connection| {
            super::remote_docker::is_docker_installed(&connection.session)
        })
    }

    pub fn list_docker_containers(&self) -> Result<Vec<super::remote_docker::DockerContainer>, String> {
        self.with_connection(|connection| {
            super::remote_docker::list_containers(&connection.session)
        })
    }

    pub fn list_docker_images(&self) -> Result<Vec<super::remote_docker::DockerImage>, String> {
        self.with_connection(|connection| {
            super::remote_docker::list_images(&connection.session)
        })
    }

    pub fn list_docker_networks(&self) -> Result<Vec<super::remote_docker::DockerNetwork>, String> {
        self.with_connection(|connection| {
            super::remote_docker::list_networks(&connection.session)
        })
    }

    pub fn list_docker_volumes(&self) -> Result<Vec<super::remote_docker::DockerVolume>, String> {
        self.with_connection(|connection| {
            super::remote_docker::list_volumes(&connection.session)
        })
    }

    pub fn get_docker_overview(&self) -> Result<super::remote_docker::DockerOverview, String> {
        self.with_connection(|connection| {
            super::remote_docker::get_docker_overview(&connection.session)
        })
    }

    pub fn docker_container_action(
        &self,
        container_id: &str,
        action: &str,
    ) -> Result<String, String> {
        self.with_connection(|connection| {
            super::remote_docker::container_action(&connection.session, container_id, action)
        })
    }

    pub fn docker_image_action(
        &self,
        image_ref: &str,
        action: &str,
    ) -> Result<String, String> {
        self.with_connection(|connection| {
            super::remote_docker::image_action(&connection.session, image_ref, action)
        })
    }

    pub fn docker_volume_action(
        &self,
        volume_name: &str,
        action: &str,
    ) -> Result<String, String> {
        self.with_connection(|connection| {
            super::remote_docker::volume_action(&connection.session, volume_name, action)
        })
    }

    pub fn docker_network_action(
        &self,
        network_ref: &str,
        action: &str,
    ) -> Result<String, String> {
        self.with_connection(|connection| {
            super::remote_docker::network_action(&connection.session, network_ref, action)
        })
    }

    pub fn docker_system_action(&self, action: &str) -> Result<String, String> {
        self.with_connection(|connection| {
            super::remote_docker::system_action(&connection.session, action)
        })
    }

    pub fn docker_container_details(
        &self,
        container_id: &str,
    ) -> Result<super::remote_docker::DockerContainerDetails, String> {
        self.with_connection(|connection| {
            super::remote_docker::container_details(&connection.session, container_id)
        })
    }

    pub fn docker_container_logs(
        &self,
        container_id: &str,
        tail: u32,
        since: &str,
    ) -> Result<String, String> {
        self.with_connection(|connection| {
            super::remote_docker::container_logs(&connection.session, container_id, tail, since)
        })
    }

    pub fn get_disk_overview(&self) -> Result<super::remote_disk::DiskOverview, String> {
        self.with_connection(|connection| {
            let os = connection.remote_os();
            super::remote_disk::get_disk_overview(&connection.session, &os)
        })
    }

    pub fn get_large_directories(
        &self,
    ) -> Result<Vec<super::remote_disk::LargeDirectory>, String> {
        self.with_connection(|connection| {
            let os = connection.remote_os();
            super::remote_disk::get_large_directories(&connection.session, &os)
        })
    }

    pub fn get_system_resources(&self) -> Result<super::remote_system::SystemResources, String> {
        self.with_connection(|connection| {
            let os = connection.remote_os();
            super::remote_system::get_system_resources(&connection.session, &os)
        })
    }

    pub fn list_ssh_sessions(&self) -> Result<Vec<super::remote_ssh_sessions::RemoteSshSession>, String> {
        self.with_connection(|connection| {
            super::remote_ssh_sessions::list_ssh_sessions(&connection.session)
        })
    }

    pub fn get_permission_overview(
        &self,
    ) -> Result<super::remote_permissions::RemotePermissionOverview, String> {
        self.with_connection(|connection| {
            super::remote_permissions::get_permission_overview(&connection.session)
        })
    }

    pub fn list_remote_users(
        &self,
    ) -> Result<Vec<super::remote_user_admin::RemoteUser>, String> {
        self.with_connection(|connection| {
            super::remote_user_admin::list_users(&connection.session, &connection.username)
        })
    }

    pub fn list_remote_groups(&self) -> Result<Vec<String>, String> {
        self.with_connection(|connection| {
            super::remote_user_admin::list_groups(&connection.session)
        })
    }

    pub fn add_remote_user_group(&self, username: &str, group: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_user_admin::add_user_to_group(&connection.session, username, group)
        })
    }

    pub fn remove_remote_user_group(&self, username: &str, group: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_user_admin::remove_user_from_group(
                &connection.session,
                &connection.username,
                username,
                group,
            )
        })
    }

    pub fn set_remote_user_passwordless_sudo(
        &self,
        username: &str,
        enabled: bool,
    ) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_user_admin::set_passwordless_sudo(
                &connection.session,
                &connection.username,
                username,
                enabled,
            )
        })
    }

    pub fn create_remote_user(
        &self,
        input: &super::remote_user_admin::CreateRemoteUserInput,
    ) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_user_admin::create_user(&connection.session, input)
        })
    }

    pub fn delete_remote_user(&self, username: &str, remove_home: bool) -> Result<(), String> {
        self.with_connection(|connection| {
            super::remote_user_admin::delete_user(
                &connection.session,
                &connection.username,
                username,
                remove_home,
            )
        })
    }

    pub fn ensure_disk_history_collector(&self) -> Result<(), String> {
        self.with_connection(|connection| {
            let home = connection.home_dir()?;
            super::remote_disk_history::ensure_disk_history_collector(&connection.session, &home)
        })
    }

    pub fn get_disk_history(
        &self,
    ) -> Result<Vec<super::remote_disk_history::DiskUsageSample>, String> {
        self.with_connection(|connection| {
            let home = connection.home_dir()?;
            super::remote_disk_history::read_disk_history(&connection.session, &home)
        })
    }

    pub fn ensure_resource_history_collector(&self) -> Result<(), String> {
        self.with_connection(|connection| {
            let home = connection.home_dir()?;
            super::remote_resource_history::ensure_resource_history_collector(
                &connection.session,
                &home,
            )
        })
    }

    pub fn list_resource_history_days(
        &self,
    ) -> Result<super::remote_resource_history::ResourceHistoryDays, String> {
        self.with_connection(|connection| {
            let home = connection.home_dir()?;
            super::remote_resource_history::list_resource_history_days(&connection.session, &home)
        })
    }

    pub fn get_resource_history(
        &self,
        date: &str,
        since_ts: Option<u64>,
    ) -> Result<Vec<super::remote_resource_history::ResourceHistorySample>, String> {
        self.with_connection(|connection| {
            let home = connection.home_dir()?;
            super::remote_resource_history::read_resource_history(
                &connection.session,
                &home,
                date,
                since_ts,
            )
        })
    }

    pub fn list_block_devices(
        &self,
    ) -> Result<Vec<super::remote_disk::BlockDevice>, String> {
        self.with_connection(|connection| {
            let os = connection.remote_os();
            super::remote_disk::list_block_devices(&connection.session, &os)
        })
    }

    pub fn get_disk_expand_status(
        &self,
    ) -> Result<super::remote_disk::DiskExpandStatus, String> {
        self.with_connection(|connection| {
            let os = connection.remote_os();
            super::remote_disk::get_expand_status(&connection.session, &os)
        })
    }

    pub fn expand_remote_disk(
        &self,
        target_size_gb: Option<u64>,
    ) -> Result<super::remote_disk::DiskExpandResult, String> {
        self.with_connection(|connection| {
            let os = connection.remote_os();
            super::remote_disk::expand_disk(&connection.session, &os, target_size_gb)
        })
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

    tcp.set_nodelay(true).map_err(|error| error.to_string())?;
    tcp.set_read_timeout(Some(Duration::from_secs(CONNECT_TIMEOUT_SECS)))
        .map_err(|error| error.to_string())?;
    tcp.set_write_timeout(Some(Duration::from_secs(CONNECT_TIMEOUT_SECS)))
        .map_err(|error| error.to_string())?;

    let sock = SockRef::from(&tcp);
    let keepalive = TcpKeepalive::new()
        .with_time(TCP_KEEPALIVE_TIME)
        .with_interval(TCP_KEEPALIVE_INTERVAL);
    let _ = sock.set_tcp_keepalive(&keepalive);

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

fn configure_session_keepalive(session: &Session) {
    // want_reply=true: 서버 응답 없으면 끊김으로 감지 가능
    session.set_keepalive(true, SSH_KEEPALIVE_INTERVAL_SECS);
}

fn open_ssh_session_from_auth(
    host: &str,
    port: u16,
    username: &str,
    auth: &StoredAuth,
) -> Result<Session, String> {
    match auth {
        StoredAuth::Pem {
            private_key_path,
            key_passphrase,
        } => open_ssh_session_with_key(
            host,
            port,
            username,
            private_key_path,
            key_passphrase.as_deref(),
        ),
        StoredAuth::Password { password } => {
            open_ssh_session_with_password(host, port, username, password)
        }
    }
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
    configure_session_keepalive(&session);
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
    configure_session_keepalive(&session);
    Ok(session)
}

fn ensure_authenticated(session: &Session) -> Result<(), String> {
    if !session.authenticated() {
        return Err("SSH 인증에 실패했습니다.".to_string());
    }
    Ok(())
}

fn session_is_alive(session: &Session) -> bool {
    session.keepalive_send().is_ok()
}

fn looks_like_disconnect(error: &str) -> bool {
    let e = error.to_ascii_lowercase();
    [
        "ssh 호스트에 연결되어 있지 않습니다",
        "broken pipe",
        "connection reset",
        "connection refused",
        "network is unreachable",
        "session has been closed",
        "unable to send",
        "failed receiving",
        "channel eof",
        "disconnected",
        "socket error",
        "wait_socket",
        "timed out",
        "timeout",
        "channel open failure",
        "채널을 열지 못했습니다",
        "원격 셸을 시작하지 못했습니다",
    ]
    .iter()
    .any(|needle| e.contains(needle))
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

            manager.tick_keepalive();
            let _ = manager.poll_shells(&app);
        }
    });
}
