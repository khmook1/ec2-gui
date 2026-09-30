use serde::Serialize;
use ssh2::Session;

use super::remote_disk_history::{install_collector, shell_single_quote, CollectorInstall};
use super::remote_fs::exec_remote_command;

const DIR_NAME: &str = ".ec2-gui";
const SCRIPT_NAME: &str = "record-resources.sh";
const HISTORY_DIR_NAME: &str = "resource-history";
const DAY_FILE_GLOB: &str = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].csv";
const MAX_DAY_FILES: usize = 30;
const CRON_MARKER: &str = "# ec2-gui-resource-history";

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
    /// 원격 서버 로컬 기준 오늘 (`YYYY-MM-DD`)
    pub today: String,
    /// 원격 서버의 UTC 오프셋(분). 날짜 경계를 계산할 때 사용한다.
    pub utc_offset_minutes: i32,
    /// 저장된 날짜 목록 (오래된 순, 최대 30개)
    pub days: Vec<String>,
}

fn app_dir(home: &str) -> String {
    format!("{}/{}", home.trim_end_matches('/'), DIR_NAME)
}

fn script_path(home: &str) -> String {
    format!("{}/{}", app_dir(home), SCRIPT_NAME)
}

fn history_dir(home: &str) -> String {
    format!("{}/{}", app_dir(home), HISTORY_DIR_NAME)
}

/// 원격에 배포하는 1분 주기 수집 스크립트 (python3).
/// 매분 cron으로 실행되어 10초 간격(:05, :15, … :55)으로 CPU·메모리·디스크 사용률을
/// `resource-history/YYYY-MM-DD.csv`에 `ts,cpu,memory,disk` 한 줄씩 추가하고, 30개 초과 파일은 삭제한다.
fn record_resources_script() -> &'static str {
    r#"#!/usr/bin/env bash
# ec2-gui resource history collector — do not edit by hand
set -euo pipefail
exec python3 - <<'PY'
import fcntl
import platform
import re
import subprocess
import time
from pathlib import Path

HOME = Path.home()
BASE = HOME / ".ec2-gui"
DIR = BASE / "resource-history"
LOCK = BASE / "record-resources.lock"
MAX_FILES = 30
INTERVAL = 10
OFFSET = 5
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.csv$")
DIR.mkdir(parents=True, exist_ok=True)

lock_fd = open(LOCK, "w")
try:
    fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    raise SystemExit(0)

IS_DARWIN = platform.system() == "Darwin"

SKIP = {
    "tmpfs", "devtmpfs", "squashfs", "overlay", "devfs",
    "proc", "sysfs", "cgroup", "cgroup2", "autofs",
}

def run(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL)

def read_cpu():
    try:
        if IS_DARWIN:
            parts = [int(v) for v in run(["sysctl", "-n", "kern.cp_time"]).split()[:4]]
            busy = parts[0] + parts[1] + parts[2]
            return busy + parts[3], parts[3]
        with open("/proc/stat", encoding="utf-8") as f:
            fields = [int(v) for v in f.readline().split()[1:11]]
        idle = fields[3]
        busy = sum(fields) - idle
        return busy + idle, idle
    except Exception:
        return None

def cpu_percent(prev, cur):
    if prev is None or cur is None:
        return None
    dt = cur[0] - prev[0]
    di = cur[1] - prev[1]
    if dt <= 0:
        return 0
    return max(0, min(100, (100 * (dt - di)) // dt))

def memory_percent():
    try:
        if IS_DARWIN:
            total = int(run(["sysctl", "-n", "hw.memsize"]).strip())
            page = int(run(["pagesize"]).strip() or 4096)
            vm = run(["vm_stat"])
            def pages(label):
                m = re.search(label + r"[^:]*:\s+(\d+)", vm)
                return int(m.group(1)) if m else 0
            used = (pages("Pages active") + pages("Pages wired") + pages("occupied by compressor")) * page
        else:
            info = {}
            with open("/proc/meminfo", encoding="utf-8") as f:
                for line in f:
                    key, _, rest = line.partition(":")
                    info[key] = int(rest.split()[0]) * 1024
            total = info.get("MemTotal", 0)
            avail = info.get("MemAvailable") or (
                info.get("MemFree", 0) + info.get("Buffers", 0) + info.get("Cached", 0)
            )
            used = total - avail
        if total <= 0:
            return None
        return max(0, min(100, (100 * used) // total))
    except Exception:
        return None

def disk_percent():
    try:
        if IS_DARWIN:
            out = run(["df", "-kP", "-l"])
        else:
            out = run(["df", "-B1", "-P", "-l"])
    except Exception:
        return None
    rows = []
    for line in out.splitlines()[1:]:
        parts = line.split()
        if len(parts) < 6:
            continue
        lower = parts[0].lower()
        if any(lower == s or lower.startswith(s + "/") for s in SKIP):
            continue
        try:
            size = int(parts[1])
            pct = int(parts[4].rstrip("%"))
        except ValueError:
            continue
        mounted = " ".join(parts[5:])
        if mounted.startswith("/snap") or lower.startswith("/dev/loop"):
            continue
        if IS_DARWIN and (
            mounted.startswith("/System/Volumes/Data/home")
            or mounted.startswith("/private/var/vm")
            or mounted == "/dev"
            or mounted.startswith("/Volumes/com.apple")
        ):
            continue
        if size <= 0:
            continue
        rank = 0 if mounted == "/" else 1 if mounted == "/System/Volumes/Data" else 2
        rows.append((rank, -size, pct))
    if not rows:
        return None
    rows.sort()
    return rows[0][2]

def day_file(ts_sec):
    return DIR / (time.strftime("%Y-%m-%d", time.localtime(ts_sec)) + ".csv")

def prune():
    files = sorted(p for p in DIR.iterdir() if p.is_file() and DAY_RE.match(p.name))
    for path in files[:max(0, len(files) - MAX_FILES)]:
        try:
            path.unlink()
        except OSError:
            pass

start = time.time()
minute = int(start) // 60 * 60
ticks = [minute + OFFSET + i * INTERVAL for i in range(60 // INTERVAL)]
prev = read_cpu()

for tick in ticks:
    now = time.time()
    if tick <= now:
        continue
    time.sleep(tick - now)
    cur = read_cpu()
    cpu = cpu_percent(prev, cur)
    prev = cur
    mem = memory_percent()
    if cpu is None or mem is None:
        continue
    disk = disk_percent()
    line = "{},{},{},{}\n".format(tick * 1000, cpu, mem, "" if disk is None else disk)
    with open(day_file(tick), "a", encoding="utf-8") as f:
        f.write(line)

prune()
PY
"#
}

pub fn ensure_resource_history_collector(session: &Session, home: &str) -> Result<(), String> {
    let dir = app_dir(home);
    let script = script_path(home);
    let cron_line = format!("* * * * * {script} >/dev/null 2>&1 {CRON_MARKER}");
    // 다음 cron 실행 전까지 비지 않도록 현재 분의 남은 구간을 백그라운드로 수집 (중복 실행은 스크립트가 lock으로 막음)
    let post_cmd = format!(
        "nohup {} >/dev/null 2>&1 </dev/null &",
        shell_single_quote(&script)
    );

    install_collector(
        session,
        &CollectorInstall {
            label: "리소스 히스토리",
            dir: &dir,
            script: &script,
            script_body: record_resources_script(),
            cron_line: &cron_line,
            marker: CRON_MARKER,
            post_cmd: &post_cmd,
        },
    )
}

pub fn list_resource_history_days(
    session: &Session,
    home: &str,
) -> Result<ResourceHistoryDays, String> {
    let dir = shell_single_quote(&history_dir(home));
    let raw = exec_remote_command(
        session,
        &format!(
            "date +%Y-%m-%d; date +%z; for f in {dir}/{DAY_FILE_GLOB}; do [ -f \"$f\" ] && basename \"$f\" .csv; done; true"
        ),
    )?;

    let mut lines = raw.lines().map(str::trim);
    let today = lines.next().unwrap_or_default().to_string();
    let utc_offset_minutes = parse_utc_offset(lines.next().unwrap_or_default());
    let mut days: Vec<String> = lines
        .filter(|line| is_valid_date(line))
        .map(str::to_string)
        .collect();
    days.sort();
    days.dedup();
    if days.len() > MAX_DAY_FILES {
        days.drain(..days.len() - MAX_DAY_FILES);
    }

    Ok(ResourceHistoryDays {
        today,
        utc_offset_minutes,
        days,
    })
}

pub fn read_resource_history(
    session: &Session,
    home: &str,
    date: &str,
    since_ts: Option<u64>,
) -> Result<Vec<ResourceHistorySample>, String> {
    if !is_valid_date(date) {
        return Err(format!("잘못된 날짜 형식입니다: {date}"));
    }

    let file = shell_single_quote(&format!("{}/{date}.csv", history_dir(home)));
    let cmd = match since_ts {
        Some(since) => format!("[ -f {file} ] && awk -F, -v s={since} '$1>s' {file}; true"),
        None => format!("[ -f {file} ] && cat {file}; true"),
    };
    let raw = exec_remote_command(session, &cmd)?;

    Ok(parse_samples(&raw))
}

fn is_valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes.iter().enumerate().all(|(i, b)| match i {
            4 | 7 => *b == b'-',
            _ => b.is_ascii_digit(),
        })
}

/// `date +%z` 출력(`+0900`, `-0430`)을 분 단위로 변환한다.
fn parse_utc_offset(value: &str) -> i32 {
    let value = value.trim();
    if value.len() != 5 {
        return 0;
    }
    let sign = match &value[..1] {
        "+" => 1,
        "-" => -1,
        _ => return 0,
    };
    let hours: i32 = value[1..3].parse().unwrap_or(0);
    let minutes: i32 = value[3..5].parse().unwrap_or(0);
    sign * (hours * 60 + minutes)
}

fn parse_samples(raw: &str) -> Vec<ResourceHistorySample> {
    let mut samples: Vec<ResourceHistorySample> =
        raw.lines().filter_map(parse_line).collect();
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
    fn validates_date_and_offset() {
        assert!(is_valid_date("2026-09-30"));
        assert!(!is_valid_date("2026-9-30"));
        assert!(!is_valid_date("2026-09-30; rm"));
        assert_eq!(parse_utc_offset("+0900"), 540);
        assert_eq!(parse_utc_offset("-0430"), -270);
        assert_eq!(parse_utc_offset("garbage"), 0);
    }
}
