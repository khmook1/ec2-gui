use serde::Serialize;
use ssh2::Session;

use super::remote_fs::exec_remote_command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskFilesystem {
    pub filesystem: String,
    pub size_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub use_percent: u32,
    pub mounted_on: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeDirectory {
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskOverview {
    /// `linux` | `macos` | `unknown`
    pub os: String,
    pub filesystems: Vec<DiskFilesystem>,
    pub large_directories: Vec<LargeDirectory>,
}

const SKIP_FILESYSTEM_TYPES: &[&str] = &[
    "tmpfs",
    "devtmpfs",
    "squashfs",
    "overlay",
    "devfs",
    "proc",
    "sysfs",
    "cgroup",
    "cgroup2",
    "autofs",
];

/// 원격 `uname -s` 결과. 대시보드 기능 노출 여부에 사용.
pub fn detect_remote_os(session: &Session) -> String {
    match exec_remote_command(session, "uname -s 2>/dev/null") {
        Ok(value) if value.eq_ignore_ascii_case("Darwin") => "macos".to_string(),
        Ok(value) if value.eq_ignore_ascii_case("Linux") => "linux".to_string(),
        _ => "unknown".to_string(),
    }
}

pub fn get_disk_overview(session: &Session) -> Result<DiskOverview, String> {
    let os = detect_remote_os(session);
    let macos = os == "macos";

    Ok(DiskOverview {
        os,
        filesystems: list_filesystems(session, macos)?,
        // macOS에서 루트 `du`는 /Users·/System 전량 스캔으로 수분 걸릴 수 있어 건너뜁니다.
        large_directories: if macos {
            Vec::new()
        } else {
            list_large_directories(session)?
        },
    })
}

fn list_filesystems(session: &Session, macos: bool) -> Result<Vec<DiskFilesystem>, String> {
    // Linux(GNU): 바이트 단위. macOS(BSD): -k(1KiB) 후 바이트로 환산.
    let (command, block_bytes) = if macos {
        ("df -kP -l 2>/dev/null", 1024u64)
    } else {
        ("df -B1 -P -l 2>/dev/null", 1u64)
    };

    let output = exec_remote_command(session, command)?;
    let mut filesystems = Vec::new();

    for line in output.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 6 {
            continue;
        }

        let filesystem = parts[0].to_string();
        let lower = filesystem.to_ascii_lowercase();
        if SKIP_FILESYSTEM_TYPES
            .iter()
            .any(|skip| lower == *skip || lower.starts_with(&format!("{skip}/")))
        {
            continue;
        }

        let size_bytes = parts[1].parse::<u64>().unwrap_or(0).saturating_mul(block_bytes);
        let used_bytes = parts[2].parse::<u64>().unwrap_or(0).saturating_mul(block_bytes);
        let available_bytes = parts[3]
            .parse::<u64>()
            .unwrap_or(0)
            .saturating_mul(block_bytes);
        let use_percent = parts[4]
            .trim_end_matches('%')
            .parse::<u32>()
            .unwrap_or(0);
        let mounted_on = parts[5..].join(" ");

        // snap/loop 마운트는 대시보드 노이즈라 제외
        if mounted_on.starts_with("/snap")
            || lower.starts_with("/dev/loop")
            || lower.starts_with("/dev/mapper/snap")
        {
            continue;
        }

        // macOS 가상·보조 마운트 노이즈
        if macos
            && (mounted_on.starts_with("/System/Volumes/Data/home")
                || mounted_on.starts_with("/private/var/vm")
                || mounted_on == "/dev"
                || mounted_on.starts_with("/Volumes/com.apple"))
        {
            continue;
        }

        if size_bytes == 0 {
            continue;
        }

        filesystems.push(DiskFilesystem {
            filesystem,
            size_bytes,
            used_bytes,
            available_bytes,
            use_percent,
            mounted_on,
        });
    }

    filesystems.sort_by(|a, b| {
        let a_root = a.mounted_on == "/" || a.mounted_on == "/System/Volumes/Data";
        let b_root = b.mounted_on == "/" || b.mounted_on == "/System/Volumes/Data";
        b_root
            .cmp(&a_root)
            .then_with(|| b.size_bytes.cmp(&a.size_bytes))
    });

    Ok(filesystems)
}

fn list_large_directories(session: &Session) -> Result<Vec<LargeDirectory>, String> {
    // 루트 1depth만 측정. 가상 FS·권한 오류는 stderr로 버리고 상위 사용량만 수집.
    let output = exec_remote_command(
        session,
        "du -xd1 -B1 / 2>/dev/null | sort -nr | head -n 15",
    )?;

    let mut directories = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut parts = trimmed.splitn(2, char::is_whitespace);
        let size_raw = parts.next().unwrap_or("").trim();
        let path = parts.next().unwrap_or("").trim();
        if size_raw.is_empty() || path.is_empty() {
            continue;
        }

        let size_bytes = match size_raw.parse::<u64>() {
            Ok(value) => value,
            Err(_) => continue,
        };

        // `/` 자체 합계는 개별 디렉터리와 중복되므로 제외
        if path == "/" {
            continue;
        }

        directories.push(LargeDirectory {
            path: path.to_string(),
            size_bytes,
        });
    }

    Ok(directories)
}
