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
];

pub fn get_disk_overview(session: &Session) -> Result<DiskOverview, String> {
    Ok(DiskOverview {
        filesystems: list_filesystems(session)?,
        large_directories: list_large_directories(session)?,
    })
}

fn list_filesystems(session: &Session) -> Result<Vec<DiskFilesystem>, String> {
    let output = exec_remote_command(session, "df -B1 -P -l 2>/dev/null")?;
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

        let size_bytes = parts[1].parse::<u64>().unwrap_or(0);
        let used_bytes = parts[2].parse::<u64>().unwrap_or(0);
        let available_bytes = parts[3].parse::<u64>().unwrap_or(0);
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
        let a_root = a.mounted_on == "/";
        let b_root = b.mounted_on == "/";
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
