use serde::{Deserialize, Serialize};
use ssh2::Session;

use super::remote_fs::{
    exec_remote_command, exec_remote_command_checked, resolve_home_directory, write_file,
};

const DIR_NAME: &str = ".ec2-gui";
const SCRIPT_NAME: &str = "record-disk.sh";
const STORAGE_NAME: &str = "storage.json";
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

fn storage_path(home: &str) -> String {
    format!("{}/{}", app_dir(home), STORAGE_NAME)
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r#"'\''"#))
}

/// 원격에 배포하는 10분 주기 수집 스크립트 (python3 + df).
fn record_disk_script() -> &'static str {
    r#"#!/usr/bin/env bash
# ec2-gui disk history collector — do not edit by hand
set -euo pipefail
exec python3 - <<'PY'
import json
import platform
import subprocess
import time
from pathlib import Path

HOME = Path.home()
DIR = HOME / ".ec2-gui"
FILE = DIR / "storage.json"
DIR.mkdir(parents=True, exist_ok=True)

SKIP = {
    "tmpfs", "devtmpfs", "squashfs", "overlay", "devfs",
    "proc", "sysfs", "cgroup", "cgroup2", "autofs",
}
HOUR_MS = 60 * 60 * 1000
BUCKET_MS = 10 * 60 * 1000
KEEP_MS = 24 * HOUR_MS

is_darwin = platform.system() == "Darwin"
try:
    if is_darwin:
        out = subprocess.check_output(["df", "-kP", "-l"], text=True, stderr=subprocess.DEVNULL)
        block = 1024
    else:
        out = subprocess.check_output(["df", "-B1", "-P", "-l"], text=True, stderr=subprocess.DEVNULL)
        block = 1
except Exception:
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
    raise SystemExit(0)

primary = rows[0]
now = int(time.time() * 1000)
bucket = (now // BUCKET_MS) * BUCKET_MS
sample = {
    "ts": bucket,
    "usePercent": int(primary["usePercent"]),
    "usedBytes": int(primary["usedBytes"]),
    "mountedOn": primary["mountedOn"],
}

samples = []
if FILE.exists():
    try:
        raw = json.loads(FILE.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            samples = raw
    except Exception:
        samples = []

samples = [
    s for s in samples
    if isinstance(s, dict) and isinstance(s.get("ts"), (int, float)) and int(s["ts"]) != bucket
]
samples.append(sample)
cutoff = now - KEEP_MS
samples = [
    s for s in samples
    if isinstance(s, dict) and isinstance(s.get("ts"), (int, float)) and int(s["ts"]) >= cutoff
]
samples.sort(key=lambda s: int(s.get("ts", 0)))
FILE.write_text(json.dumps(samples, ensure_ascii=False), encoding="utf-8")
PY
"#
}

fn install_cron(session: &Session, script: &str) -> Result<(), String> {
    let line = format!("*/10 * * * * {script} {CRON_MARKER}");
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
    let path = storage_path(&home);
    let raw = exec_remote_command(
        session,
        &format!("cat '{path}' 2>/dev/null || echo '[]'"),
    )?;

    if raw.is_empty() || raw == "[]" {
        return Ok(Vec::new());
    }

    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("storage.json 파싱 실패: {error}"))?;

    let Some(arr) = parsed.as_array() else {
        return Ok(Vec::new());
    };

    let mut samples = Vec::new();
    for item in arr {
        let ts = item
            .get("ts")
            .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|n| n as u64)));
        let use_percent = item
            .get("usePercent")
            .and_then(|v| v.as_u64())
            .map(|n| n as u32);
        let used_bytes = item.get("usedBytes").and_then(|v| v.as_u64());
        let mounted_on = item
            .get("mountedOn")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        if let (Some(ts), Some(use_percent), Some(used_bytes), Some(mounted_on)) =
            (ts, use_percent, used_bytes, mounted_on)
        {
            samples.push(DiskUsageSample {
                ts,
                use_percent,
                used_bytes,
                mounted_on,
            });
        }
    }

    samples.sort_by_key(|s| s.ts);
    Ok(samples)
}
