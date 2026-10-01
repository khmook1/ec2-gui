use std::time::Duration;

use super::{CpuResource, MemoryResource, NetworkResource, SystemResources};

/// `cat /proc/stat /proc/loadavg /proc/meminfo /proc/net/dev` 출력 한 번 분량.
/// 원격에서 awk 등을 띄우지 않고 이 컴퓨터에서 파싱한다. 없는 파일의 값은 비어 있다.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProcSnapshot {
    /// `/proc/stat` `cpu` 줄 누적 카운터 (total, idle)
    pub cpu: Option<(u64, u64)>,
    pub cores: u32,
    pub load1: f64,
    mem_total_kb: Option<u64>,
    mem_available_kb: Option<u64>,
    mem_free_kb: u64,
    mem_buffers_kb: u64,
    mem_cached_kb: u64,
    /// 루프백을 뺀 누적 트래픽 최대 인터페이스 (이름, rx, tx 바이트)
    pub net: Option<(String, u64, u64)>,
}

impl ProcSnapshot {
    pub fn parse(output: &str) -> Self {
        let mut snapshot = Self::default();

        for line in output.lines() {
            let line = line.trim();
            let parts: Vec<&str> = line.split_whitespace().collect();
            let Some(&first) = parts.first() else {
                continue;
            };

            if first == "cpu" {
                let values: Vec<u64> = parts[1..]
                    .iter()
                    .take(10)
                    .filter_map(|value| value.parse().ok())
                    .collect();
                if values.len() >= 4 {
                    snapshot.cpu = Some((values.iter().sum(), values[3]));
                }
                continue;
            }

            if first.len() > 3
                && first.starts_with("cpu")
                && first[3..].bytes().all(|b| b.is_ascii_digit())
            {
                snapshot.cores += 1;
                continue;
            }

            if let Some((key, rest)) = line.split_once(':') {
                snapshot.parse_colon_line(key.trim(), rest);
                continue;
            }

            // /proc/loadavg: `0.12 0.10 0.05 1/234 5678`
            if parts.len() == 5 && parts[3].contains('/') {
                snapshot.load1 = first.parse().unwrap_or(0.0);
            }
        }

        snapshot
    }

    /// `/proc/meminfo`(`MemTotal: 123 kB`) 또는 `/proc/net/dev`(`eth0: rx … tx …`) 줄.
    fn parse_colon_line(&mut self, key: &str, rest: &str) {
        let values: Vec<&str> = rest.split_whitespace().collect();

        if values.len() >= 16 {
            if key == "lo" {
                return;
            }
            let rx: u64 = values[0].parse().unwrap_or(0);
            let tx: u64 = values[8].parse().unwrap_or(0);
            let busier = self.net.as_ref().map_or(true, |(_, best_rx, best_tx)| {
                rx.saturating_add(tx) >= best_rx.saturating_add(*best_tx)
            });
            if busier {
                self.net = Some((key.to_string(), rx, tx));
            }
            return;
        }

        let kb = values.first().and_then(|value| value.parse::<u64>().ok());
        match key {
            "MemTotal" => self.mem_total_kb = kb,
            "MemAvailable" => self.mem_available_kb = kb,
            "MemFree" => self.mem_free_kb = kb.unwrap_or(0),
            "Buffers" => self.mem_buffers_kb = kb.unwrap_or(0),
            "Cached" => self.mem_cached_kb = kb.unwrap_or(0),
            _ => {}
        }
    }

    pub fn memory(&self) -> Option<MemoryResource> {
        let total_kb = self.mem_total_kb.filter(|total| *total > 0)?;
        let available_kb = match self.mem_available_kb {
            Some(value) if value > 0 => value,
            _ => self.mem_free_kb + self.mem_buffers_kb + self.mem_cached_kb,
        };
        let total_bytes = total_kb * 1024;
        let available_bytes = (available_kb * 1024).min(total_bytes);
        let used_bytes = total_bytes - available_bytes;

        Some(MemoryResource {
            total_bytes,
            used_bytes,
            available_bytes,
            use_percent: (100 * used_bytes / total_bytes).min(100) as u32,
        })
    }

    /// `base` 이후 `elapsed` 동안의 CPU 사용률·NIC 초당 바이트로 스냅샷을 만든다.
    pub fn resources_since(
        &self,
        base: &ProcSnapshot,
        elapsed: Duration,
    ) -> Result<SystemResources, String> {
        let (total, idle) = self
            .cpu
            .ok_or_else(|| "CPU 정보를 파싱하지 못했습니다.".to_string())?;
        let use_percent = match base.cpu {
            Some((base_total, base_idle)) => {
                let dt = total.saturating_sub(base_total);
                let di = idle.saturating_sub(base_idle);
                if dt == 0 {
                    0
                } else {
                    (100 * dt.saturating_sub(di) / dt).min(100) as u32
                }
            }
            None => 0,
        };

        let memory = self
            .memory()
            .ok_or_else(|| "메모리 정보를 파싱하지 못했습니다.".to_string())?;

        let elapsed_ms = (elapsed.as_millis() as u64).max(1);
        let rate = |now: u64, then: u64| now.saturating_sub(then) * 1000 / elapsed_ms;
        let network = match &self.net {
            Some((name, rx, tx)) => match &base.net {
                Some((base_name, base_rx, base_tx)) if base_name == name => NetworkResource {
                    interface: name.clone(),
                    rx_bytes_per_sec: rate(*rx, *base_rx),
                    tx_bytes_per_sec: rate(*tx, *base_tx),
                },
                _ => NetworkResource {
                    interface: name.clone(),
                    rx_bytes_per_sec: 0,
                    tx_bytes_per_sec: 0,
                },
            },
            None => NetworkResource {
                interface: "—".to_string(),
                rx_bytes_per_sec: 0,
                tx_bytes_per_sec: 0,
            },
        };

        Ok(SystemResources {
            cpu: CpuResource {
                cores: self.cores.max(1),
                load1: self.load1,
                use_percent,
            },
            memory,
            network,
            memory_pressure: None,
            host: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::ProcSnapshot;

    fn sample(user: u64, idle: u64, rx: u64, tx: u64) -> String {
        format!(
            "cpu  {user} 0 100 {idle} 0 0 0 0 0 0\n\
cpu0 1 0 1 1 0 0 0 0 0 0\n\
cpu1 1 0 1 1 0 0 0 0 0 0\n\
intr 12345 1 2 3\n\
ctxt 999\n\
procs_running 1\n\
1.42 0.80 0.50 2/345 6789\n\
MemTotal:        1000 kB\n\
MemFree:          100 kB\n\
MemAvailable:     600 kB\n\
Buffers:           50 kB\n\
Cached:           200 kB\n\
Inter-|   Receive                                                |  Transmit\n\
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n\
    lo: 999999 10 0 0 0 0 0 0 999999 10 0 0 0 0 0 0\n\
  eth0: {rx} 10 0 0 0 0 0 0 {tx} 10 0 0 0 0 0 0\n"
        )
    }

    #[test]
    fn parses_proc_files() {
        let snapshot = ProcSnapshot::parse(&sample(900, 1000, 5000, 3000));
        assert_eq!(snapshot.cpu, Some((2000, 1000)));
        assert_eq!(snapshot.cores, 2);
        assert!((snapshot.load1 - 1.42).abs() < f64::EPSILON);
        assert_eq!(snapshot.net, Some(("eth0".to_string(), 5000, 3000)));

        let memory = snapshot.memory().unwrap();
        assert_eq!(memory.total_bytes, 1000 * 1024);
        assert_eq!(memory.available_bytes, 600 * 1024);
        assert_eq!(memory.use_percent, 40);
    }

    #[test]
    fn computes_rates_from_base() {
        let base = ProcSnapshot::parse(&sample(900, 1000, 5000, 3000));
        let current = ProcSnapshot::parse(&sample(1200, 1100, 15000, 5000));
        let resources = current
            .resources_since(&base, Duration::from_secs(5))
            .unwrap();
        assert_eq!(resources.cpu.use_percent, 75);
        assert_eq!(resources.network.interface, "eth0");
        assert_eq!(resources.network.rx_bytes_per_sec, 2000);
        assert_eq!(resources.network.tx_bytes_per_sec, 400);
    }

    #[test]
    fn falls_back_without_mem_available() {
        let snapshot = ProcSnapshot::parse("MemTotal: 1000 kB\nMemFree: 100 kB\nBuffers: 50 kB\nCached: 200 kB\n");
        assert_eq!(snapshot.memory().unwrap().use_percent, 65);
    }
}
