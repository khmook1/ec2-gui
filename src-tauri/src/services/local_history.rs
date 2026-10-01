use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use tauri::{AppHandle, Manager};

use super::remote_disk::DiskFilesystem;
use super::remote_fs::exec_remote_command;
use super::remote_system::ProcSnapshot;
use super::ssh::SshConnectionManager;

pub const HISTORY_DIR_NAME: &str = "server-history";
const RESOURCE_DIR_NAME: &str = "resource";
const DISK_DIR_NAME: &str = "disk";
const MAX_DAY_FILES: usize = 30;
const SAMPLE_INTERVAL_MS: u64 = 10_000;
/// 디스크는 하루 1개 값만 남기므로 샘플마다 덮어쓰지 않는다.
const DISK_WRITE_INTERVAL: Duration = Duration::from_secs(10 * 60);
const DF_MARKER: &str = "__df__";

static SAMPLER_STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResourceHistorySample {
    pub ts: u64,
    pub cpu: u32,
    pub memory: u32,
    pub disk: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceHistoryDays {
    /// 이 컴퓨터 기준 오늘 (`YYYY-MM-DD`)
    pub today: String,
    /// 이 컴퓨터의 UTC 오프셋(분). 날짜 경계를 계산할 때 사용한다.
    pub utc_offset_minutes: i32,
    /// 저장된 날짜 목록 (오래된 순, 최대 30개)
    pub days: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsageSample {
    pub ts: u64,
    pub use_percent: u32,
    pub used_bytes: u64,
    pub mounted_on: String,
}

/// 읽기 전용 명령만 실행한다. 서버에 파일·cron을 남기지 않는다.
/// 원격에서 awk를 띄우지 않고 이 컴퓨터에서 파싱한다 (`ProcSnapshot`).
const LINUX_RESOURCE_CMD: &str = "cat /proc/stat /proc/meminfo 2>/dev/null";
const LINUX_DF_CMD: &str = "df -B1 -P -l 2>/dev/null";

const MACOS_RESOURCE_CMD: &str = r#"set +e
set -- $(sysctl -n kern.cp_time 2>/dev/null)
[ $# -ge 4 ] && echo "cpu $(($1 + $2 + $3 + $4)) $4"
TOTAL=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
PAGE=$(pagesize 2>/dev/null || echo 4096)
vm_stat 2>/dev/null | awk -v total="$TOTAL" -v page="$PAGE" '
  /Pages active/ {gsub(/\./,"",$3); a=$3}
  /Pages wired/ {gsub(/\./,"",$4); w=$4}
  /occupied by compressor/ {gsub(/\./,"",$5); c=$5}
  END { if (total>0) { p=int(100*(a+w+c)*page/total); if (p>100) p=100; print "mem", p } }'"#;
const MACOS_DF_CMD: &str = "df -kP -l 2>/dev/null";

const SKIP_FILESYSTEMS: &[&str] = &[
    "tmpfs", "devtmpfs", "squashfs", "overlay", "devfs", "proc", "sysfs", "cgroup", "cgroup2",
    "autofs",
];

#[derive(Debug, Default, PartialEq)]
struct RawSample {
    /// `/proc/stat`·`kern.cp_time` 누적 카운터 (total, idle)
    cpu: Option<(u64, u64)>,
    memory: Option<u32>,
    disk: Option<PrimaryDisk>,
}

#[derive(Debug, Clone, PartialEq)]
struct PrimaryDisk {
    use_percent: u32,
    used_bytes: u64,
    mounted_on: String,
}

#[derive(Default)]
struct ConnectionState {
    prev_cpu: Option<(u64, u64)>,
    last_disk_write: Option<Instant>,
}

/// 앱이 켜져 있는 동안 연결된 모든 세션을 10초마다 샘플링해 로컬에 저장하는 스레드를 한 번만 띄운다.
pub fn ensure_sampler(app: AppHandle) {
    if SAMPLER_STARTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    std::thread::spawn(move || {
        let mut states: HashMap<String, ConnectionState> = HashMap::new();
        loop {
            let now = now_ms();
            let next = (now / SAMPLE_INTERVAL_MS + 1) * SAMPLE_INTERVAL_MS;
            std::thread::sleep(Duration::from_millis(next - now));

            let Some(manager) = app.try_state::<SshConnectionManager>() else {
                continue;
            };
            let Ok(root) = history_root(&app) else {
                continue;
            };
            let live = manager.for_each_connection(|id, server_key, os, session| {
                let state = states.entry(id.to_string()).or_default();
                let _ = sample_connection(&root, server_key, os, session, next, state);
            });
            states.retain(|id, _| live.contains(id));
        }
    });
}

pub fn history_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(HISTORY_DIR_NAME))
        .map_err(|error| format!("app data dir: {error}"))
}

fn sample_connection(
    root: &Path,
    server_key: &str,
    os: &str,
    session: &Session,
    ts: u64,
    state: &mut ConnectionState,
) -> Result<(), String> {
    let (resource_cmd, df_cmd) = match os {
        "linux" => (LINUX_RESOURCE_CMD, LINUX_DF_CMD),
        "macos" => (MACOS_RESOURCE_CMD, MACOS_DF_CMD),
        _ => return Ok(()),
    };
    let raw = exec_remote_command(
        session,
        &format!("{resource_cmd}\necho {DF_MARKER}\n{df_cmd}"),
    )?;
    let sample = parse_raw_sample(&raw, os == "macos");
    let dir = server_dir(root, server_key);

    let cpu = match (state.prev_cpu, sample.cpu) {
        (Some(prev), Some(cur)) => cpu_percent(prev, cur),
        _ => None,
    };
    state.prev_cpu = sample.cpu;

    if let (Some(cpu), Some(memory)) = (cpu, sample.memory) {
        append_resource_sample(
            &dir,
            &ResourceHistorySample {
                ts,
                cpu,
                memory,
                disk: sample.disk.as_ref().map(|disk| disk.use_percent),
            },
        )?;
    }

    if let Some(disk) = &sample.disk {
        let due = state
            .last_disk_write
            .map_or(true, |at| at.elapsed() >= DISK_WRITE_INTERVAL);
        if due {
            write_disk_sample(&dir, disk)?;
            state.last_disk_write = Some(Instant::now());
        }
    }
    Ok(())
}

/// 오늘 디스크 샘플이 없으면 디스크 개요에서 이미 받은 파일시스템으로 한 번 기록한다.
/// (첫 연결 직후 차트가 비지 않게, `df`를 다시 실행하지 않는다)
pub fn ensure_today_disk_sample_from_filesystems(
    root: &Path,
    server_key: &str,
    os: &str,
    filesystems: &[DiskFilesystem],
) -> Result<(), String> {
    if !matches!(os, "linux" | "macos") {
        return Ok(());
    }
    let dir = server_dir(root, server_key);
    let Some(today) = local_date(now_ms()) else {
        return Ok(());
    };
    if dir.join(DISK_DIR_NAME).join(format!("{today}.json")).is_file() {
        return Ok(());
    }
    let rows = filesystems.iter().map(|fs| DiskRow {
        filesystem: &fs.filesystem,
        size_bytes: fs.size_bytes,
        used_bytes: fs.used_bytes,
        use_percent: fs.use_percent,
        mounted_on: fs.mounted_on.clone(),
    });
    if let Some(disk) = choose_primary_disk(rows, os == "macos") {
        write_disk_sample(&dir, &disk)?;
    }
    Ok(())
}

pub fn list_resource_history_days(root: &Path, server_key: &str) -> ResourceHistoryDays {
    let now = Local::now();
    let mut days = day_files(&server_dir(root, server_key).join(RESOURCE_DIR_NAME), "csv")
        .into_iter()
        .map(|(date, _)| date)
        .collect::<Vec<_>>();
    if days.len() > MAX_DAY_FILES {
        days.drain(..days.len() - MAX_DAY_FILES);
    }

    ResourceHistoryDays {
        today: now.format("%Y-%m-%d").to_string(),
        utc_offset_minutes: now.offset().local_minus_utc() / 60,
        days,
    }
}

pub fn read_resource_history(
    root: &Path,
    server_key: &str,
    date: &str,
    since_ts: Option<u64>,
) -> Result<Vec<ResourceHistorySample>, String> {
    if !is_valid_date(date) {
        return Err(format!("잘못된 날짜 형식입니다: {date}"));
    }
    let file = server_dir(root, server_key)
        .join(RESOURCE_DIR_NAME)
        .join(format!("{date}.csv"));
    let raw = match fs::read_to_string(&file) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("리소스 기록을 읽지 못했습니다: {error}")),
    };

    let mut samples = parse_samples(&raw);
    if let Some(since) = since_ts {
        samples.retain(|sample| sample.ts > since);
    }
    Ok(samples)
}

/// 일별 디스크 샘플을 날짜순으로 최근 30일만 반환한다.
pub fn read_disk_history(root: &Path, server_key: &str) -> Vec<DiskUsageSample> {
    let mut samples: Vec<DiskUsageSample> =
        day_files(&server_dir(root, server_key).join(DISK_DIR_NAME), "json")
            .into_iter()
            .filter_map(|(_, path)| fs::read_to_string(path).ok())
            .filter_map(|raw| serde_json::from_str(&raw).ok())
            .collect();
    samples.sort_by_key(|sample| sample.ts);
    samples.dedup_by_key(|sample| sample.ts);
    if samples.len() > MAX_DAY_FILES {
        samples.drain(..samples.len() - MAX_DAY_FILES);
    }
    samples
}

fn append_resource_sample(dir: &Path, sample: &ResourceHistorySample) -> Result<(), String> {
    let Some(date) = local_date(sample.ts) else {
        return Ok(());
    };
    let resource_dir = dir.join(RESOURCE_DIR_NAME);
    fs::create_dir_all(&resource_dir).map_err(|error| error.to_string())?;
    let file = resource_dir.join(format!("{date}.csv"));
    let is_new = !file.exists();

    let disk = sample.disk.map(|v| v.to_string()).unwrap_or_default();
    let mut handle = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file)
        .map_err(|error| error.to_string())?;
    writeln!(handle, "{},{},{},{disk}", sample.ts, sample.cpu, sample.memory)
        .map_err(|error| error.to_string())?;

    if is_new {
        prune_day_files(&resource_dir, "csv");
    }
    Ok(())
}

fn write_disk_sample(dir: &Path, disk: &PrimaryDisk) -> Result<(), String> {
    let now = Local::now();
    let Some(day_start) = now
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .and_then(|start| start.and_local_timezone(Local).earliest())
    else {
        return Ok(());
    };
    let disk_dir = dir.join(DISK_DIR_NAME);
    fs::create_dir_all(&disk_dir).map_err(|error| error.to_string())?;

    let sample = DiskUsageSample {
        ts: day_start.timestamp_millis().max(0) as u64,
        use_percent: disk.use_percent,
        used_bytes: disk.used_bytes,
        mounted_on: disk.mounted_on.clone(),
    };
    let body = serde_json::to_string(&sample).map_err(|error| error.to_string())?;
    let file = disk_dir.join(format!("{}.json", now.format("%Y-%m-%d")));
    let tmp = file.with_extension("json.tmp");
    fs::write(&tmp, body).map_err(|error| error.to_string())?;
    fs::rename(&tmp, &file).map_err(|error| error.to_string())?;

    prune_day_files(&disk_dir, "json");
    Ok(())
}

/// `dir` 안의 `YYYY-MM-DD.{ext}` 파일을 날짜순으로 반환한다.
fn day_files(dir: &Path, ext: &str) -> Vec<(String, PathBuf)> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut files: Vec<(String, PathBuf)> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;
            let date = name.strip_suffix(&format!(".{ext}"))?;
            (is_valid_date(date) && path.is_file()).then(|| (date.to_string(), path.clone()))
        })
        .collect();
    files.sort();
    files
}

fn prune_day_files(dir: &Path, ext: &str) {
    let files = day_files(dir, ext);
    for (_, path) in files.iter().take(files.len().saturating_sub(MAX_DAY_FILES)) {
        let _ = fs::remove_file(path);
    }
}

/// `user@host:port` → 파일 이름으로 쓸 수 있는 폴더명
fn server_dir(root: &Path, server_key: &str) -> PathBuf {
    let name: String = server_key
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '@') {
                c
            } else {
                '_'
            }
        })
        .collect();
    root.join(name)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn local_date(ts_ms: u64) -> Option<String> {
    Local
        .timestamp_millis_opt(ts_ms as i64)
        .single()
        .map(|dt| dt.format("%Y-%m-%d").to_string())
}

fn cpu_percent(prev: (u64, u64), cur: (u64, u64)) -> Option<u32> {
    // 재부팅 등으로 카운터가 줄었으면 이번 샘플은 버린다.
    let total = cur.0.checked_sub(prev.0)?;
    let idle = cur.1.checked_sub(prev.1)?;
    if total == 0 {
        return Some(0);
    }
    Some((100 * total.saturating_sub(idle) / total).min(100) as u32)
}

fn parse_raw_sample(raw: &str, is_macos: bool) -> RawSample {
    let (head, df) = raw.split_once(DF_MARKER).unwrap_or((raw, ""));
    let mut sample = RawSample::default();

    if !is_macos {
        let snapshot = ProcSnapshot::parse(head);
        sample.cpu = snapshot.cpu;
        sample.memory = snapshot.memory().map(|memory| memory.use_percent);
        sample.disk = pick_primary_disk(df, is_macos);
        return sample;
    }

    for line in head.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        match parts.as_slice() {
            ["cpu", total, idle] => {
                if let (Ok(total), Ok(idle)) = (total.parse(), idle.parse()) {
                    sample.cpu = Some((total, idle));
                }
            }
            ["mem", pct] => {
                sample.memory = pct.parse::<u32>().ok().map(|v| v.min(100));
            }
            _ => {}
        }
    }

    sample.disk = pick_primary_disk(df, is_macos);
    sample
}

struct DiskRow<'a> {
    filesystem: &'a str,
    size_bytes: u64,
    used_bytes: u64,
    use_percent: u32,
    mounted_on: String,
}

/// `df -P` 출력에서 주 디스크를 고른다.
fn pick_primary_disk(df: &str, is_macos: bool) -> Option<PrimaryDisk> {
    let block: u64 = if is_macos { 1024 } else { 1 };
    let rows = df.lines().filter_map(|line| {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 6 {
            return None;
        }
        let (Ok(size), Ok(used), Ok(pct)) = (
            parts[1].parse::<u64>(),
            parts[2].parse::<u64>(),
            parts[4].trim_end_matches('%').parse::<u32>(),
        ) else {
            return None;
        };
        Some(DiskRow {
            filesystem: parts[0],
            size_bytes: size * block,
            used_bytes: used * block,
            use_percent: pct,
            mounted_on: parts[5..].join(" "),
        })
    });
    choose_primary_disk(rows, is_macos)
}

/// 루트(`/`, macOS는 `/System/Volumes/Data`)를 우선으로, 없으면 가장 큰 파일시스템을 고른다.
fn choose_primary_disk<'a>(
    rows: impl IntoIterator<Item = DiskRow<'a>>,
    is_macos: bool,
) -> Option<PrimaryDisk> {
    let mut candidates: Vec<(u8, u64, PrimaryDisk)> = Vec::new();

    for row in rows {
        let lower = row.filesystem.to_ascii_lowercase();
        if SKIP_FILESYSTEMS
            .iter()
            .any(|skip| lower == *skip || lower.starts_with(&format!("{skip}/")))
        {
            continue;
        }
        let mounted = row.mounted_on;
        if mounted.starts_with("/snap") || lower.starts_with("/dev/loop") {
            continue;
        }
        if is_macos
            && (mounted.starts_with("/System/Volumes/Data/home")
                || mounted.starts_with("/private/var/vm")
                || mounted == "/dev"
                || mounted.starts_with("/Volumes/com.apple"))
        {
            continue;
        }
        if row.size_bytes == 0 {
            continue;
        }
        let rank = match mounted.as_str() {
            "/" => 0,
            "/System/Volumes/Data" => 1,
            _ => 2,
        };
        candidates.push((
            rank,
            row.size_bytes,
            PrimaryDisk {
                use_percent: row.use_percent.min(100),
                used_bytes: row.used_bytes,
                mounted_on: mounted,
            },
        ));
    }

    candidates.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)));
    candidates.into_iter().next().map(|(_, _, disk)| disk)
}

fn is_valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes.iter().enumerate().all(|(i, b)| match i {
            4 | 7 => *b == b'-',
            _ => b.is_ascii_digit(),
        })
}

fn parse_samples(raw: &str) -> Vec<ResourceHistorySample> {
    let mut samples: Vec<ResourceHistorySample> = raw.lines().filter_map(parse_line).collect();
    samples.sort_by_key(|s| s.ts);
    samples.dedup_by_key(|s| s.ts);
    samples
}

fn parse_line(line: &str) -> Option<ResourceHistorySample> {
    let mut parts = line.trim().split(',');
    let ts = parts.next()?.trim().parse().ok()?;
    let cpu = parts.next()?.trim().parse().ok()?;
    let memory = parts.next()?.trim().parse().ok()?;
    let disk = parts.next().and_then(|v| v.trim().parse().ok());
    Some(ResourceHistorySample {
        ts,
        cpu,
        memory,
        disk,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lines_sorted_deduped_and_skips_invalid() {
        let raw = "3000,30,40,50\n1000,10,20,\nnot,a,line\n\n2000,15,25,35\n3000,99,99,99\n";
        let samples = parse_samples(raw);
        assert_eq!(
            samples,
            vec![
                ResourceHistorySample { ts: 1000, cpu: 10, memory: 20, disk: None },
                ResourceHistorySample { ts: 2000, cpu: 15, memory: 25, disk: Some(35) },
                ResourceHistorySample { ts: 3000, cpu: 30, memory: 40, disk: Some(50) },
            ]
        );
    }

    #[test]
    fn parses_raw_sample_and_picks_root() {
        let raw = "cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 100 0 100 800 0 0 0 0 0 0\nintr 1 2 3\n\
MemTotal: 1000 kB\nMemFree: 100 kB\nMemAvailable: 580 kB\n__df__\n\
Filesystem 1-blocks Used Available Capacity Mounted on\n\
tmpfs 100 1 99 1% /run\n\
/dev/xvdb1 5000 1000 4000 20% /data\n\
/dev/xvda1 2000 1500 500 75% /\n\
/dev/loop0 10 10 0 100% /snap/core\n";
        let sample = parse_raw_sample(raw, false);
        assert_eq!(sample.cpu, Some((1000, 800)));
        assert_eq!(sample.memory, Some(42));
        assert_eq!(
            sample.disk,
            Some(PrimaryDisk { use_percent: 75, used_bytes: 1500, mounted_on: "/".into() })
        );
    }

    #[test]
    fn parses_macos_raw_sample() {
        let raw = "cpu 1000 800\nmem 42\n__df__\n";
        let sample = parse_raw_sample(raw, true);
        assert_eq!(sample.cpu, Some((1000, 800)));
        assert_eq!(sample.memory, Some(42));
    }

    #[test]
    fn picks_primary_from_overview_filesystems() {
        let rows = vec![
            DiskRow {
                filesystem: "/dev/xvdb1",
                size_bytes: 5000,
                used_bytes: 1000,
                use_percent: 20,
                mounted_on: "/data".into(),
            },
            DiskRow {
                filesystem: "/dev/xvda1",
                size_bytes: 2000,
                used_bytes: 1500,
                use_percent: 75,
                mounted_on: "/".into(),
            },
        ];
        assert_eq!(
            choose_primary_disk(rows, false),
            Some(PrimaryDisk { use_percent: 75, used_bytes: 1500, mounted_on: "/".into() })
        );
    }

    #[test]
    fn computes_cpu_percent_and_drops_counter_reset() {
        assert_eq!(cpu_percent((1000, 800), (1100, 850)), Some(50));
        assert_eq!(cpu_percent((1000, 800), (1000, 800)), Some(0));
        assert_eq!(cpu_percent((1000, 800), (500, 400)), None);
    }

    #[test]
    fn sanitizes_server_dir() {
        let dir = server_dir(Path::new("/tmp"), "ec2-user@10.0.0.1:22");
        assert_eq!(dir, PathBuf::from("/tmp/ec2-user@10.0.0.1_22"));
    }
}
