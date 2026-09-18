use serde::Serialize;

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
    /// `linux` | `macos` | `windows` | `unknown`
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

/// `df -P` 계열 출력을 파싱. `block_bytes`로 블록 단위를 바이트로 환산한다.
pub fn parse_df_output(output: &str, block_bytes: u64) -> Vec<DiskFilesystem> {
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

    filesystems
}

pub fn sort_filesystems(filesystems: &mut [DiskFilesystem]) {
    filesystems.sort_by(|a, b| {
        let a_root = a.mounted_on == "/" || a.mounted_on == "/System/Volumes/Data";
        let b_root = b.mounted_on == "/" || b.mounted_on == "/System/Volumes/Data";
        b_root
            .cmp(&a_root)
            .then_with(|| b.size_bytes.cmp(&a.size_bytes))
    });
}

pub fn parse_large_directories(output: &str) -> Vec<LargeDirectory> {
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

    directories
}
