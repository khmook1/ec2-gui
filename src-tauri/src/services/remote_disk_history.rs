use serde::{Deserialize, Serialize};
use ssh2::Session;

use super::remote_fs::{exec_remote_command, exec_remote_command_checked, write_file};

const DIR_NAME: &str = ".ec2-gui";
const SCRIPT_NAME: &str = "record-disk.sh";
const SCRIPT_VERSION: u32 = 1;
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

pub(super) fn shell_single_quote(value: &str) -> String {
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

const VERSION_TAG: &str = "# ec2-gui-script-version:";

pub(super) struct CollectorInstall<'a> {
    /// 에러 메시지용 이름 (예: "디스크 히스토리")
    pub label: &'a str,
    pub dir: &'a str,
    pub script: &'a str,
    pub script_body: &'a str,
    /// 스크립트 내용·출력 형식을 바꾸면 올려야 한다. 원격에 더 높은 버전이 있으면 덮어쓰지 않는다.
    pub version: u32,
    /// 끝에 `marker`를 포함한 crontab 한 줄
    pub cron_line: &'a str,
    pub marker: &'a str,
    /// 설치 직후 실행할 셸 명령. 실패해도 설치는 성공으로 본다.
    pub post_cmd: &'a str,
}

/// 셰뱅 다음 줄에 버전 태그를 넣는다.
fn with_version_tag(body: &str, version: u32) -> String {
    match body.split_once('\n') {
        Some((shebang, rest)) => format!("{shebang}\n{VERSION_TAG} {version}\n{rest}"),
        None => format!("{VERSION_TAG} {version}\n{body}"),
    }
}

/// 원격 스크립트의 버전 태그 값을 `$VAR`에 읽는 셸 조각. 태그가 없으면(구버전·미설치) 0.
fn read_version_cmd(var: &str, script: &str) -> String {
    format!(
        "{var}=$(sed -n 's/^{VERSION_TAG} \\([0-9][0-9]*\\)$/\\1/p' {script} 2>/dev/null | head -n 1); {var}=${{{var}:-0}}"
    )
}

/// 같은 계정으로 여러 클라이언트가 동시에 설치할 때 교체·crontab 수정을 직렬화하는 mkdir 잠금.
/// 10초 넘게 풀리지 않으면 비정상 종료로 남은 잠금으로 보고 가져간다.
fn install_lock_cmd(dir: &str) -> String {
    format!(
        "LOCK={dir}/.install.lock
i=0
while ! mkdir \"$LOCK\" 2>/dev/null; do
  i=$((i + 1))
  if [ \"$i\" -ge 50 ]; then rm -rf \"$LOCK\"; mkdir \"$LOCK\" 2>/dev/null; break; fi
  sleep 0.2
done
trap 'rmdir \"$LOCK\" 2>/dev/null' EXIT"
    )
}

/// python3 확인·디렉터리 생성·원격 버전 확인(exec 1) → 임시 파일로 업로드(sftp)
/// → 잠금 안에서 버전 재확인·`mv` 교체·crontab·후처리(exec 2).
/// 원격 스크립트가 더 높은 버전이면 아무것도 바꾸지 않고, 같은 버전이면 업로드를 건너뛴다.
/// `mv`는 원자적으로 교체되므로 실행 중인 cron이 비어 있는 파일을 읽지 않는다.
pub(super) fn install_collector(session: &Session, spec: &CollectorInstall) -> Result<(), String> {
    let dir = shell_single_quote(spec.dir);
    let script = shell_single_quote(spec.script);
    let version = spec.version;
    let preflight = exec_remote_command(
        session,
        &format!(
            "command -v python3 >/dev/null 2>&1 || {{ echo NO_PYTHON3; exit 0; }}; \
mkdir -p {dir} || exit 0; {}; echo \"OK $CUR\"",
            read_version_cmd("CUR", &script)
        ),
    )?;
    if preflight.contains("NO_PYTHON3") {
        return Err(format!("{} 수집에 python3가 필요합니다.", spec.label));
    }
    let remote_version = match preflight.trim().strip_prefix("OK ") {
        Some(value) => value.trim().parse::<u32>().unwrap_or(0),
        None => {
            return Err(format!("{} 디렉터리를 만들지 못했습니다: {}", spec.label, spec.dir));
        }
    };
    if remote_version > version {
        return Ok(());
    }

    let tmp = if remote_version < version {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let tmp = format!("{}.tmp-{nanos}", spec.script);
        write_file(session, &tmp, &with_version_tag(spec.script_body, version))?;
        Some(shell_single_quote(&tmp))
    } else {
        None
    };

    let replace = match &tmp {
        Some(tmp) => format!(
            "if [ \"$CUR\" -gt {version} ]; then rm -f {tmp}; exit 0; fi
chmod +x {tmp} && mv -f {tmp} {script} || {{ rm -f {tmp}; echo '스크립트 교체에 실패했습니다.'; exit 1; }}"
        ),
        None => format!(
            "if [ \"$CUR\" -gt {version} ]; then exit 0; fi
chmod +x {script} || {{ echo 'chmod 실패'; exit 1; }}"
        ),
    };
    let lock = install_lock_cmd(&dir);
    let read_current = read_version_cmd("CUR", &script);
    let line = shell_single_quote(spec.cron_line);
    let marker = shell_single_quote(spec.marker);
    let post_cmd = spec.post_cmd;
    let install = format!(
        "{lock}
{read_current}
{replace}
if ! crontab -l 2>/dev/null | grep -qxF {line}; then
  TMP=$(mktemp 2>/dev/null || echo /tmp/ec2-gui-cron.$$)
  crontab -l 2>/dev/null | grep -vF {marker} > \"$TMP\" || true
  printf '%s\\n' {line} >> \"$TMP\"
  crontab \"$TMP\"; STATUS=$?; rm -f \"$TMP\"
  [ \"$STATUS\" -eq 0 ] || {{ echo 'crontab 설치에 실패했습니다. (권한·cron 서비스 확인)'; exit 2; }}
fi
{{ {post_cmd}
}} || true
exit 0"
    );
    exec_remote_command_checked(session, &install)?;
    Ok(())
}

pub fn ensure_disk_history_collector(session: &Session, home: &str) -> Result<(), String> {
    let dir = app_dir(home);
    let script = script_path(home);
    let cron_line = format!("55 23 * * * {script} {CRON_MARKER}");
    let post_cmd = format!("{} >/dev/null 2>&1", shell_single_quote(&script));

    install_collector(
        session,
        &CollectorInstall {
            label: "디스크 히스토리",
            dir: &dir,
            script: &script,
            script_body: record_disk_script(),
            version: SCRIPT_VERSION,
            cron_line: &cron_line,
            marker: CRON_MARKER,
            post_cmd: &post_cmd,
        },
    )
}

pub fn read_disk_history(session: &Session, home: &str) -> Result<Vec<DiskUsageSample>, String> {
    let dir = shell_single_quote(&history_dir(home));
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

    #[test]
    fn inserts_version_tag_after_shebang() {
        let body = with_version_tag("#!/usr/bin/env bash\necho hi\n", 3);
        assert_eq!(
            body,
            "#!/usr/bin/env bash\n# ec2-gui-script-version: 3\necho hi\n"
        );
    }
}
