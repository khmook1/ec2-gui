use std::io::{Read, Write};
use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use ssh2::{FileStat, FileType, Session};

#[derive(Debug, Clone)]
pub struct RemoteIdentity {
    pub uid: u32,
    pub groups: Vec<u32>,
}

const MODE_READ: u8 = 0o4;
const MODE_EXEC: u8 = 0o1;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified_at: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDirectoryListing {
    pub path: String,
    pub entries: Vec<RemoteEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFileContent {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub content: String,
    pub truncated: bool,
    pub is_binary: bool,
    pub is_image: bool,
}

const MAX_PREVIEW_BYTES: usize = 1024 * 1024;
const MAX_WRITE_BYTES: usize = 1024 * 1024;

pub fn resolve_home_directory(session: &Session, username: &str) -> Result<String, String> {
    match exec_remote_command(session, "echo $HOME") {
        Ok(home) if !home.is_empty() => Ok(home),
        _ => Ok(format!("/home/{username}")),
    }
}

pub fn resolve_remote_identity(session: &Session) -> Result<RemoteIdentity, String> {
    let uid = exec_remote_command(session, "id -u")?
        .parse::<u32>()
        .map_err(|error| format!("원격 UID를 해석할 수 없습니다: {error}"))?;

    let primary_gid = exec_remote_command(session, "id -g")?
        .parse::<u32>()
        .map_err(|error| format!("원격 GID를 해석할 수 없습니다: {error}"))?;

    let mut groups: Vec<u32> = exec_remote_command(session, "id -G")?
        .split_whitespace()
        .filter_map(|value| value.parse::<u32>().ok())
        .collect();

    if !groups.contains(&primary_gid) {
        groups.push(primary_gid);
    }

    Ok(RemoteIdentity { uid, groups })
}

pub fn list_directory(
    session: &Session,
    path: &str,
    identity: &RemoteIdentity,
) -> Result<RemoteDirectoryListing, String> {
    let normalized = normalize_remote_path(path);

    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    let mut entries = Vec::new();

    for item in sftp
        .readdir(Path::new(&normalized))
        .map_err(|error| format!("디렉터리를 읽을 수 없습니다: {error}"))?
    {
        let (path_buf, mut stat) = item;
        let name = path_buf
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_string();

        if name.is_empty() || name == "." || name == ".." {
            continue;
        }

        let entry_path = join_remote_path(&normalized, &name);
        if stat.perm.is_none() || stat.uid.is_none() || stat.gid.is_none() {
            if let Ok(full_stat) = sftp.stat(Path::new(&entry_path)) {
                stat = full_stat;
            }
        }

        let is_directory = stat.file_type() == FileType::Directory;
        if !entry_visible_to_identity(&stat, is_directory, identity) {
            continue;
        }

        let size = if is_directory { 0 } else { stat.size.unwrap_or(0) };
        let modified_at = stat.mtime.map(|value| value as u64);

        entries.push(RemoteEntry {
            name,
            path: entry_path,
            is_directory,
            size,
            modified_at,
        });
    }

    entries.sort_by(|left, right| {
        match (left.is_directory, right.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
        }
    });

    Ok(RemoteDirectoryListing {
        path: normalized,
        entries,
    })
}

pub fn create_directory(session: &Session, path: &str) -> Result<(), String> {
    let normalized = normalize_remote_path(path);
    validate_mutable_path(&normalized)?;

    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    if sftp.stat(Path::new(&normalized)).is_ok() {
        return Err("같은 이름의 항목이 이미 있습니다.".to_string());
    }

    sftp.mkdir(Path::new(&normalized), 0o755)
        .map_err(|error| format!("폴더를 만들 수 없습니다: {error}"))?;

    Ok(())
}

pub fn create_file(session: &Session, path: &str) -> Result<(), String> {
    let normalized = normalize_remote_path(path);
    validate_mutable_path(&normalized)?;

    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    if sftp.stat(Path::new(&normalized)).is_ok() {
        return Err("같은 이름의 항목이 이미 있습니다.".to_string());
    }

    sftp.create(Path::new(&normalized))
        .map_err(|error| format!("파일을 만들 수 없습니다: {error}"))?;

    Ok(())
}

pub fn delete_path(session: &Session, path: &str) -> Result<(), String> {
    let normalized = normalize_remote_path(path);
    validate_mutable_path(&normalized)?;

    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    delete_path_recursive(&sftp, &normalized)
}

pub fn read_file(session: &Session, path: &str) -> Result<RemoteFileContent, String> {
    let normalized = normalize_remote_path(path);
    if normalized == "/" {
        return Err("파일을 읽을 수 없습니다.".to_string());
    }

    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    let stat = sftp
        .stat(Path::new(&normalized))
        .map_err(|error| format!("파일을 찾을 수 없습니다: {error}"))?;

    if stat.file_type() == FileType::Directory {
        return Err("폴더는 미리볼 수 없습니다.".to_string());
    }

    let size = stat.size.unwrap_or(0);
    let mut file = sftp
        .open(Path::new(&normalized))
        .map_err(|error| format!("파일을 열 수 없습니다: {error}"))?;

    let mut buffer = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut truncated = false;

    loop {
        if buffer.len() >= MAX_PREVIEW_BYTES {
            truncated = size as usize > buffer.len() || file.read(&mut chunk).unwrap_or(0) > 0;
            break;
        }

        let remaining = MAX_PREVIEW_BYTES - buffer.len();
        let read_len = remaining.min(chunk.len());
        let n = file
            .read(&mut chunk[..read_len])
            .map_err(|error| format!("파일을 읽을 수 없습니다: {error}"))?;

        if n == 0 {
            break;
        }

        buffer.extend_from_slice(&chunk[..n]);
    }

    let name = normalized
        .rsplit('/')
        .next()
        .unwrap_or(&normalized)
        .to_string();

    let image_mime = guess_image_mime(&name);
    let is_image = image_mime.is_some();
    let is_binary = !is_image && is_likely_binary(&buffer);
    let content = if let Some(mime) = image_mime {
        if truncated {
            String::new()
        } else {
            format!("data:{mime};base64,{}", STANDARD.encode(&buffer))
        }
    } else if is_binary {
        String::new()
    } else {
        String::from_utf8_lossy(&buffer).into_owned()
    };

    Ok(RemoteFileContent {
        path: normalized,
        name,
        size,
        content,
        truncated,
        is_binary,
        is_image,
    })
}

pub fn write_file(session: &Session, path: &str, content: &str) -> Result<(), String> {
    let normalized = normalize_remote_path(path);
    validate_mutable_path(&normalized)?;

    let bytes = content.as_bytes();
    if bytes.len() > MAX_WRITE_BYTES {
        return Err(format!(
            "파일 내용이 너무 큽니다. (최대 {}바이트)",
            MAX_WRITE_BYTES
        ));
    }

    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;

    if let Ok(stat) = sftp.stat(Path::new(&normalized)) {
        if stat.file_type() == FileType::Directory {
            return Err("폴더에는 쓸 수 없습니다.".to_string());
        }
    }

    let mut file = sftp
        .create(Path::new(&normalized))
        .map_err(|error| format!("파일을 열 수 없습니다: {error}"))?;

    file.write_all(bytes)
        .map_err(|error| format!("파일을 저장할 수 없습니다: {error}"))?;

    Ok(())
}

/// 프론트엔드가 비밀번호 입력을 띄우는 신호로 쓰는 오류 코드
pub const SUDO_PASSWORD_REQUIRED: &str = "SUDO_PASSWORD_REQUIRED";

/// 쓰기 권한이 없는 파일을 sudo 로 저장한다.
/// 사용자 소유 임시 파일에 SFTP 로 쓴 뒤 `sudo sh -c 'cat tmp > target'` 로 덮어써서 기존 소유자·권한을 유지한다.
pub fn write_file_with_sudo(
    session: &Session,
    path: &str,
    content: &str,
    password: Option<&str>,
) -> Result<(), String> {
    let normalized = normalize_remote_path(path);
    validate_mutable_path(&normalized)?;

    let bytes = content.as_bytes();
    if bytes.len() > MAX_WRITE_BYTES {
        return Err(format!(
            "파일 내용이 너무 큽니다. (최대 {}바이트)",
            MAX_WRITE_BYTES
        ));
    }

    let temp_path = exec_remote_command_checked(session, "mktemp /tmp/ec2-gui-save.XXXXXX")
        .map_err(|error| format!("임시 파일을 만들 수 없습니다: {error}"))?;
    if temp_path.is_empty() {
        return Err("임시 파일을 만들 수 없습니다.".to_string());
    }

    let result = write_temp_file(session, &temp_path, bytes)
        .and_then(|()| sudo_copy_file(session, &temp_path, &normalized, password));

    let _ = exec_remote_command(session, &format!("rm -f -- {}", shell_quote(&temp_path)));

    result
}

fn write_temp_file(session: &Session, temp_path: &str, bytes: &[u8]) -> Result<(), String> {
    let sftp = session
        .sftp()
        .map_err(|error| format!("SFTP 채널을 열 수 없습니다: {error}"))?;
    let mut file = sftp
        .create(Path::new(temp_path))
        .map_err(|error| format!("임시 파일을 열 수 없습니다: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("임시 파일에 쓸 수 없습니다: {error}"))
}

fn sudo_copy_file(
    session: &Session,
    temp_path: &str,
    target_path: &str,
    password: Option<&str>,
) -> Result<(), String> {
    let sudo_flags = if password.is_some() { "-S -p ''" } else { "-n" };
    // 오류 메시지 판별을 위해 로케일 고정, stderr 는 stdout 으로 합친다
    let command = format!(
        "LC_ALL=C sudo {sudo_flags} -- sh -c 'cat -- \"$1\" > \"$2\"' sh {} {} 2>&1",
        shell_quote(temp_path),
        shell_quote(target_path),
    );

    let mut channel = session
        .channel_session()
        .map_err(|error| error.to_string())?;
    channel
        .exec(&command)
        .map_err(|error| format!("원격 명령 실행 실패: {error}"))?;
    if let Some(password) = password {
        channel
            .write_all(format!("{password}\n").as_bytes())
            .map_err(|error| error.to_string())?;
    }
    channel.send_eof().ok();

    let mut output = String::new();
    channel
        .read_to_string(&mut output)
        .map_err(|error| error.to_string())?;
    channel.wait_close().ok();

    let code = channel.exit_status().unwrap_or(1);
    if code == 0 {
        return Ok(());
    }

    let lower = output.to_ascii_lowercase();
    if lower.contains("a password is required") {
        return Err(SUDO_PASSWORD_REQUIRED.to_string());
    }
    if lower.contains("incorrect password") || lower.contains("sorry, try again") {
        return Err("sudo 비밀번호가 올바르지 않습니다.".to_string());
    }
    if lower.contains("not in the sudoers")
        || lower.contains("may not run sudo")
        || lower.contains("is not allowed to execute")
    {
        return Err("이 계정은 sudo 권한이 없습니다.".to_string());
    }

    let trimmed = output.trim();
    Err(if trimmed.is_empty() {
        format!("sudo 저장 실패 (exit {code})")
    } else {
        format!("sudo 저장 실패: {trimmed}")
    })
}

pub(super) fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn is_likely_binary(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return false;
    }

    let sample = &bytes[..bytes.len().min(8_192)];
    if sample.contains(&0) {
        return true;
    }

    let non_text = sample
        .iter()
        .filter(|byte| {
            let value = **byte;
            !(value == b'\n'
                || value == b'\r'
                || value == b'\t'
                || (0x20..=0x7E).contains(&value)
                || value >= 0x80)
        })
        .count();

    (non_text as f32) / (sample.len() as f32) > 0.3
}

fn guess_image_mime(filename: &str) -> Option<&'static str> {
    let extension = filename
        .rsplit('.')
        .next()
        .filter(|ext| !ext.is_empty() && *ext != filename)?
        .to_ascii_lowercase();

    match extension.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

fn delete_path_recursive(sftp: &ssh2::Sftp, path: &str) -> Result<(), String> {
    let stat = sftp
        .stat(Path::new(path))
        .map_err(|error| format!("삭제할 항목을 찾을 수 없습니다: {error}"))?;

    if stat.file_type() == FileType::Directory {
        for item in sftp
            .readdir(Path::new(path))
            .map_err(|error| format!("폴더를 읽을 수 없습니다: {error}"))?
        {
            let (path_buf, _) = item;
            let name = path_buf
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_string();

            if name.is_empty() || name == "." || name == ".." {
                continue;
            }

            let child_path = join_remote_path(path, &name);
            delete_path_recursive(sftp, &child_path)?;
        }

        sftp.rmdir(Path::new(path))
            .map_err(|error| format!("폴더를 삭제할 수 없습니다: {error}"))?;
    } else {
        sftp.unlink(Path::new(path))
            .map_err(|error| format!("파일을 삭제할 수 없습니다: {error}"))?;
    }

    Ok(())
}

fn validate_mutable_path(path: &str) -> Result<(), String> {
    if path == "/" {
        return Err("루트 경로는 변경할 수 없습니다.".to_string());
    }

    let name = path.rsplit('/').next().unwrap_or("");
    if name.is_empty() || name == "." || name == ".." {
        return Err("올바르지 않은 경로입니다.".to_string());
    }

    if name.contains('/') {
        return Err("올바르지 않은 이름입니다.".to_string());
    }

    Ok(())
}

pub fn exec_remote_command(session: &Session, command: &str) -> Result<String, String> {
    let mut channel = session
        .channel_session()
        .map_err(|error| error.to_string())?;
    channel
        .exec(command)
        .map_err(|error| format!("원격 명령 실행 실패: {error}"))?;

    let mut output = String::new();
    channel
        .read_to_string(&mut output)
        .map_err(|error| error.to_string())?;
    channel.wait_close().ok();

    Ok(output.trim().to_string())
}

pub struct RemoteCommandOutput {
    /// stdout과 stderr를 터미널처럼 합친 출력
    pub output: String,
    pub exit_code: Option<i32>,
    pub truncated: bool,
    pub timed_out: bool,
}

/// stderr를 stdout에 합쳐 읽는다. 따로 읽으면 stderr가 많을 때(`find /` 등) 채널 윈도가 차서 멈춘다.
/// 세션 타임아웃에 걸리면 에러 대신 그때까지의 출력을 `timed_out`으로 돌려준다.
pub fn exec_remote_command_output(
    session: &Session,
    command: &str,
    max_bytes: usize,
) -> Result<RemoteCommandOutput, String> {
    let mut channel = session
        .channel_session()
        .map_err(|error| error.to_string())?;
    channel
        .handle_extended_data(ssh2::ExtendedData::Merge)
        .map_err(|error| error.to_string())?;
    channel
        .exec(command)
        .map_err(|error| format!("원격 명령 실행 실패: {error}"))?;
    channel.send_eof().ok();

    let mut buffer: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut truncated = false;
    let mut timed_out = false;
    loop {
        match channel.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                let room = max_bytes.saturating_sub(buffer.len());
                if read >= room {
                    buffer.extend_from_slice(&chunk[..room]);
                    truncated = true;
                    break;
                }
                buffer.extend_from_slice(&chunk[..read]);
            }
            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                timed_out = true;
                break;
            }
            Err(error) => {
                channel.close().ok();
                return Err(format!("원격 명령 출력 읽기 실패: {error}"));
            }
        }
    }

    let exit_code = if truncated || timed_out {
        channel.close().ok();
        None
    } else {
        channel.wait_close().ok();
        channel.exit_status().ok()
    };

    Ok(RemoteCommandOutput {
        output: String::from_utf8_lossy(&buffer).into_owned(),
        exit_code,
        truncated,
        timed_out,
    })
}

pub fn exec_remote_command_checked(session: &Session, command: &str) -> Result<String, String> {
    exec_remote_command_checked_with_input(session, command, None)
}

/// `input` 은 명령줄 대신 stdin 으로 전달된다 (비밀번호 등 `ps` 에 노출되면 안 되는 값용).
pub fn exec_remote_command_checked_with_input(
    session: &Session,
    command: &str,
    input: Option<&str>,
) -> Result<String, String> {
    let mut channel = session
        .channel_session()
        .map_err(|error| error.to_string())?;
    channel
        .exec(command)
        .map_err(|error| format!("원격 명령 실행 실패: {error}"))?;
    if let Some(input) = input {
        channel
            .write_all(input.as_bytes())
            .map_err(|error| error.to_string())?;
    }
    channel.send_eof().ok();

    let mut output = String::new();
    channel
        .read_to_string(&mut output)
        .map_err(|error| error.to_string())?;
    channel.wait_close().ok();

    let code = channel.exit_status().unwrap_or(1);
    let trimmed = output.trim().to_string();
    if code != 0 {
        return Err(if trimmed.is_empty() {
            format!("원격 명령 실패 (exit {code})")
        } else {
            trimmed
        });
    }

    Ok(trimmed)
}

fn normalize_remote_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed == "~" {
        return "/".to_string();
    }

    let mut normalized = trimmed.replace('\\', "/");
    if !normalized.starts_with('/') {
        normalized = format!("/{normalized}");
    }

    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }

    normalized
}

fn join_remote_path(base: &str, name: &str) -> String {
    if base == "/" {
        return format!("/{name}");
    }
    format!("{base}/{name}")
}

fn entry_visible_to_identity(stat: &FileStat, is_directory: bool, identity: &RemoteIdentity) -> bool {
    if identity.uid == 0 {
        return true;
    }

    let Some(perm) = stat.perm else {
        return false;
    };

    let bits = effective_permission_bits(perm, stat.uid, stat.gid, identity);
    if is_directory {
        bits & MODE_READ != 0 && bits & MODE_EXEC != 0
    } else {
        bits & MODE_READ != 0
    }
}

fn effective_permission_bits(
    perm: u32,
    file_uid: Option<u32>,
    file_gid: Option<u32>,
    identity: &RemoteIdentity,
) -> u8 {
    let mode = perm & 0o777;

    if file_uid == Some(identity.uid) {
        return ((mode >> 6) & 0o7) as u8;
    }

    if let Some(gid) = file_gid {
        if identity.groups.contains(&gid) {
            return ((mode >> 3) & 0o7) as u8;
        }
    }

    (mode & 0o7) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity(uid: u32, groups: &[u32]) -> RemoteIdentity {
        RemoteIdentity {
            uid,
            groups: groups.to_vec(),
        }
    }

    fn stat_with(perm: u32, uid: u32, gid: u32) -> FileStat {
        FileStat {
            size: None,
            uid: Some(uid),
            gid: Some(gid),
            perm: Some(perm),
            atime: None,
            mtime: None,
        }
    }

    #[test]
    fn hides_directory_without_traverse_permission() {
        let user = identity(1000, &[1000]);
        let directory = stat_with(0o040700, 999, 999);
        assert!(!entry_visible_to_identity(&directory, true, &user));
    }

    #[test]
    fn shows_directory_with_owner_read_and_execute() {
        let user = identity(1000, &[1000]);
        let directory = stat_with(0o040700, 1000, 1000);
        assert!(entry_visible_to_identity(&directory, true, &user));
    }

    #[test]
    fn hides_unreadable_file() {
        let user = identity(1000, &[1000]);
        let file = stat_with(0o100200, 0, 0);
        assert!(!entry_visible_to_identity(&file, false, &user));
    }

    #[test]
    fn uses_group_bits_when_gid_matches() {
        let user = identity(1000, &[2000]);
        let file = stat_with(0o100640, 0, 2000);
        assert!(entry_visible_to_identity(&file, false, &user));
    }
}

#[allow(dead_code)]
pub fn parent_remote_path(path: &str) -> Option<String> {
    let normalized = normalize_remote_path(path);
    if normalized == "/" {
        return None;
    }

    let mut parts: Vec<&str> = normalized.split('/').filter(|part| !part.is_empty()).collect();
    parts.pop()?;

    if parts.is_empty() {
        Some("/".to_string())
    } else {
        Some(format!("/{}", parts.join("/")))
    }
}
