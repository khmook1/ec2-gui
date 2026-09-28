use serde::{Deserialize, Serialize};
use ssh2::Session;

use super::remote_fs::{
    exec_remote_command, exec_remote_command_checked, resolve_home_directory, write_file,
};

const DIR_NAME: &str = ".ec2-gui";
const SCRIPT_NAME: &str = "record-disk.sh";
const HISTORY_DIR_NAME: &str = "disk-history";
const DAY_FILE_GLOB: &str = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].json";
const MAX_DAY_FILES: usize = 30;
const CRON_MARKER: &str = "# ec2-gui-disk-history";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsageSample {
    pub ts: u64,
    pub use_percent: u32,
    pub used_bytes: u64,
    pub mounted_on: String,
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

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'\''"#))
}

/// 원격에 배포하는 1일 주기 수집 스크립트 (python3 + df).
/// 하루 1파일(`disk-history/YYYY-MM-DD.json`)에 그날 최신 샘플을 덮어쓰고, 30개 초과분은 오래된 순으로 삭제한다.
fn record_disk_script() -> &'static str {
    r#"#!/usr/bin/env bash
# ec2-gui disk history collector — do not edit by hand
set -euo pipefail
exec python3 - <<'PY'
import json
import platform
import re
import subprocess
import time
from pathlib import Path

HOME = Path.home()
BASE = HOME / ".ec2-gui"
DIR = BASE / "disk-history"
LEGACY_FILE = BASE / "storage.json"
MAX_FILES = 30
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")
DIR.mkdir(parents=True, exist_ok=True)

SKIP = {
    "tmpfs", "devtmpfs", "squashfs", "overlay", "devfs",
    "proc", "sysfs", "cgroup", "cgroup2", "autofs",
}

def day_start_ms(ts_sec):
    lt = time.localtime(ts_sec)
    return int(time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1)) * 1000)

def day_file(ts_sec):
    return DIR / (time.strftime("%Y-%m-%d", time.localtime(ts_sec)) + ".json")

def write_day(ts_sec, sample, overwrite=True):
    path = day_file(ts_sec)
    if not overwrite and path.exists():
        return
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(sample, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)

def prune():
    files = sorted(p for p in DIR.iterdir() if p.is_file() and DAY_RE.match(p.name))
    for path in files[:max(0, len(files) - MAX_FILES)]:
        try:
            path.unlink()
        except OSError:
            pass

def migrate_legacy():
    if not LEGACY_FILE.exists():
        return
    try:
        raw = json.loads(LEGACY_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = []
    latest = {}
    for s in raw if isinstance(raw, list) else []:
        if not isinstance(s, dict) or not isinstance(s.get("ts"), (int, float)):
            continue
        ts_sec = int(s["ts"]) // 1000
        key = time.strftime("%Y-%m-%d", time.localtime(ts_sec))
        if key not in latest or int(latest[key]["ts"]) < int(s["ts"]):
            latest[key] = s
    for s in latest.values():
        ts_sec = int(s["ts"]) // 1000
        write_day(ts_sec, {
            "ts": day_start_ms(ts_sec),
            "usePercent": int(s.get("usePercent", 0)),
            "usedBytes": int(s.get("usedBytes", 0)),
            "mountedOn": str(s.get("mountedOn", "")),
        }, overwrite=False)
    try:
        LEGACY_FILE.unlink()
    except OSError:
        pass

migrate_legacy()

is_darwin = platform.system() == "Darwin"
try:
    if is_darwin:
        out = subprocess.check_output(["df", "-kP", "-l"], text=True, stderr=subprocess.DEVNULL)
        block = 1024
    else:
        out = subprocess.check_output(["df", "-B1", "-P", "-l"], text=True, stderr=subprocess.DEVNULL)
        block = 1
except Exception:
    prune()
    raise SystemExit(0)

rows = []
for line in out.splitlines()[1:]:
    parts = line.split()
    if len(parts) < 6:
        continue
    filesystem = parts[0]
    lower = filesystem.lower()
    if any(lower == s or lower.startswith(s + "/") for s in SKIP):
        continue
    try:
        size = int(parts[1]) * block
        used = int(parts[2]) * block
        pct = int(parts[4].rstrip("%"))
    except ValueError:
        continue
    mounted = " ".join(parts[5:])
    if mounted.startswith("/snap") or lower.startswith("/dev/loop"):
        continue
    if is_darwin and (
        mounted.startswith("/System/Volumes/Data/home")
        or mounted.startswith("/private/var/vm")
        or mounted == "/dev"
        or mounted.startswith("/Volumes/com.apple")
    ):
        continue
    if size <= 0:
        continue
    rows.append({
        "usedBytes": used,
        "usePercent": pct,
        "mountedOn": mounted,
        "sizeBytes": size,
    })

def rank(row):
    m = row["mountedOn"]
    if m == "/":
        return 0
    if m == "/System/Volumes/Data":
        return 1
    return 2

rows.sort(key=lambda r: (rank(r), -r["sizeBytes"]))
if not rows:
    prune()
    raise SystemExit(0)

primary = rows[0]
now_sec = int(time.time())
write_day(now_sec, {
    "ts": day_start_ms(now_sec),
    "usePercent": int(primary["usePercent"]),
    "usedBytes": int(primary["usedBytes"]),
    "mountedOn": primary["mountedOn"],
})
prune()
PY
"#
}

fn install_cron(session: &Session, script: &str) -> Result<(), String> {
    let line = format!("55 23 * * * {script} {CRON_MARKER}");
    let quoted_line = shell_single_quote(&line);
    let marker = shell_single_quote(CRON_MARKER);
    let cmd = format!(
        "TMP=$(mktemp 2>/dev/null || echo /tmp/ec2-gui-cron.$$); \
crontab -l 2>/dev/null | grep -vF {marker} > \"$TMP\" || true; \
printf '%s\\n' {quoted_line} >> \"$TMP\"; \
crontab \"$TMP\"; STATUS=$?; rm -f \"$TMP\"; exit $STATUS"
    );
    exec_remote_command_checked(session, &cmd).map_err(|error| {
        format!("crontab 설치에 실패했습니다. (권한·cron 서비스 확인): {error}")
    })?;
    Ok(())
}

pub fn ensure_disk_history_collector(
    session: &Session,
    username: &str,
) -> Result<(), String> {
    let home = resolve_home_directory(session, username)?;
    let dir = app_dir(&home);
    let script = script_path(&home);

    let py = exec_remote_command(session, "command -v python3 2>/dev/null")?;
    if py.is_empty() {
        return Err("디스크 히스토리 수집에 python3가 필요합니다.".to_string());
    }

    exec_remote_command_checked(session, &format!("mkdir -p '{dir}'"))?;
    write_file(session, &script, record_disk_script())?;
    exec_remote_command_checked(session, &format!("chmod +x '{script}'"))?;
    install_cron(session, &script)?;

    // 시드 실패해도 cron은 유지
    let _ = exec_remote_command_checked(session, &format!("'{script}'"));

    Ok(())
}

pub fn read_disk_history(
    session: &Session,
    username: &str,
) -> Result<Vec<DiskUsageSample>, String> {
    let home = resolve_home_directory(session, username)?;
    let dir = shell_single_quote(&history_dir(&home));
    let raw = exec_remote_command(
        session,
        &format!(
            "for f in {dir}/{DAY_FILE_GLOB}; do [ -f \"$f\" ] && {{ cat \"$f\"; echo; }}; done; true"
        ),
    )?;

    Ok(parse_day_samples(&raw))
}

/// 일별 파일 내용(한 줄에 JSON 객체 1개)을 날짜순으로 정렬해 최근 30일만 반환한다.
fn parse_day_samples(raw: &str) -> Vec<DiskUsageSample> {
    let mut samples: Vec<DiskUsageSample> = raw
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .filter_map(|item| parse_sample(&item))
        .collect();

    samples.sort_by_key(|s| s.ts);
    samples.dedup_by_key(|s| s.ts);
    if samples.len() > MAX_DAY_FILES {
        samples.drain(..samples.len() - MAX_DAY_FILES);
    }
    samples
}

fn parse_sample(item: &serde_json::Value) -> Option<DiskUsageSample> {
    let ts = item
        .get("ts")
        .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|n| n as u64)))?;
    let use_percent = item.get("usePercent").and_then(|v| v.as_u64())? as u32;
    let used_bytes = item.get("usedBytes").and_then(|v| v.as_u64())?;
    let mounted_on = item.get("mountedOn").and_then(|v| v.as_str())?.to_string();

    Some(DiskUsageSample {
        ts,
        use_percent,
        used_bytes,
        mounted_on,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_day_files_sorted_and_capped() {
        let raw = (0..35)
            .rev()
            .map(|day| {
                format!(
                    r#"{{"ts":{},"usePercent":{},"usedBytes":100,"mountedOn":"/"}}"#,
                    day * 86_400_000u64,
                    day
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        let samples = parse_day_samples(&format!("{raw}\n\nnot-json\n"));
        assert_eq!(samples.len(), MAX_DAY_FILES);
        assert_eq!(samples.first().map(|s| s.use_percent), Some(5));
        assert_eq!(samples.last().map(|s| s.use_percent), Some(34));
    }
}
