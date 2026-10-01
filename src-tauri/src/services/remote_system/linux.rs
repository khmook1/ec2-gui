use std::time::{Duration, Instant};

use ssh2::Session;

use super::proc::ProcSnapshot;
use super::SystemResources;
use super::super::remote_fs::exec_remote_command;

const PROC_FILES: &str = "/proc/stat /proc/loadavg /proc/meminfo /proc/net/dev";
const SECOND_SNAPSHOT_MARKER: &str = "__second__";
/// 직전 조회가 이보다 오래되면 그 사이 평균이 되므로, 짧은 간격으로 두 번 읽어 비교한다.
const MAX_BASE_AGE: Duration = Duration::from_secs(15);
const FIRST_SAMPLE_GAP: Duration = Duration::from_millis(300);

/// 직전 조회의 `/proc` 누적 카운터. 다음 조회는 이것과 비교해 `cat` 한 번으로 끝낸다.
pub struct ProcCounters {
    snapshot: ProcSnapshot,
    at: Instant,
}

/// Linux `/proc` 기반 스냅샷. CPU·NET은 직전 조회(없으면 0.3초 전) 대비 사용률/초당 바이트다.
pub fn get_system_resources(
    session: &Session,
    counters: &mut Option<ProcCounters>,
) -> Result<SystemResources, String> {
    let base = counters
        .take()
        .filter(|prev| prev.at.elapsed() <= MAX_BASE_AGE);

    let (base, current, elapsed) = match base {
        Some(prev) => {
            let output = exec_remote_command(session, &format!("cat {PROC_FILES} 2>/dev/null"))?;
            (prev.snapshot, ProcSnapshot::parse(&output), prev.at.elapsed())
        }
        None => {
            let output = exec_remote_command(
                session,
                &format!(
                    "cat {PROC_FILES} 2>/dev/null\nsleep {:.1}\necho {SECOND_SNAPSHOT_MARKER}\ncat {PROC_FILES} 2>/dev/null",
                    FIRST_SAMPLE_GAP.as_secs_f64()
                ),
            )?;
            let (first, second) = output
                .split_once(SECOND_SNAPSHOT_MARKER)
                .ok_or_else(|| "시스템 리소스 출력을 해석하지 못했습니다.".to_string())?;
            (
                ProcSnapshot::parse(first),
                ProcSnapshot::parse(second),
                FIRST_SAMPLE_GAP,
            )
        }
    };

    let resources = current.resources_since(&base, elapsed)?;
    *counters = Some(ProcCounters {
        snapshot: current,
        at: Instant::now(),
    });
    Ok(resources)
}
