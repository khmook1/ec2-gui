use ssh2::Session;

use super::{
    CpuResource, MemoryResource, NetworkResource, SystemResources,
};
use super::super::remote_fs::exec_remote_command;

/// Linux `/proc` 기반 스냅샷. CPU·NET은 짧은 샘플 간격으로 사용률/초당 바이트를 계산한다.
pub fn get_system_resources(session: &Session) -> Result<SystemResources, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e
read_cpu() { awk '/^cpu / { u=$2+$3+$4+$6+$7+$8+$9+$10+$11; i=$5; print u+i, i }' /proc/stat; }
read_net() {
  awk '
    BEGIN { best=""; br=0; bt=0 }
    NR>2 {
      iface=$1; gsub(/:/,"",iface);
      if (iface=="lo") next;
      rx=$2+0; tx=$10+0;
      if (rx+tx >= br+bt) { best=iface; br=rx; bt=tx }
    }
    END { if (best=="") print "— 0 0"; else print best, br, bt }
  ' /proc/net/dev
}

CORES=$(nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo || echo 1)
LOAD1=$(awk '{print $1}' /proc/loadavg)

read T1 I1 <<EOF
$(read_cpu)
EOF
read IFACE R1 T1B <<EOF
$(read_net)
EOF

sleep 0.3

read T2 I2 <<EOF
$(read_cpu)
EOF
read _ R2 T2B <<EOF
$(read_net)
EOF

DT=$((T2 - T1))
DI=$((I2 - I1))
if [ "$DT" -gt 0 ]; then
  CPU_PCT=$(( (100 * (DT - DI)) / DT ))
else
  CPU_PCT=0
fi
if [ "$CPU_PCT" -lt 0 ]; then CPU_PCT=0; fi
if [ "$CPU_PCT" -gt 100 ]; then CPU_PCT=100; fi

MEM_TOTAL=$(awk '/^MemTotal:/ {print $2*1024}' /proc/meminfo)
MEM_AVAIL=$(awk '/^MemAvailable:/ {print $2*1024}' /proc/meminfo)
if [ -z "$MEM_AVAIL" ] || [ "$MEM_AVAIL" = "0" ]; then
  MEM_FREE=$(awk '/^MemFree:/ {print $2*1024}' /proc/meminfo)
  MEM_BUFF=$(awk '/^Buffers:/ {print $2*1024}' /proc/meminfo)
  MEM_CACHE=$(awk '/^Cached:/ {print $2*1024}' /proc/meminfo)
  MEM_AVAIL=$((MEM_FREE + MEM_BUFF + MEM_CACHE))
fi
MEM_USED=$((MEM_TOTAL - MEM_AVAIL))
if [ "$MEM_TOTAL" -gt 0 ]; then
  MEM_PCT=$(( (100 * MEM_USED) / MEM_TOTAL ))
else
  MEM_PCT=0
fi

RX_BPS=$(( (R2 - R1) * 10 / 3 ))
TX_BPS=$(( (T2B - T1B) * 10 / 3 ))
if [ "$RX_BPS" -lt 0 ]; then RX_BPS=0; fi
if [ "$TX_BPS" -lt 0 ]; then TX_BPS=0; fi

printf 'cpu\t%s\t%s\t%s\n' "$CORES" "$LOAD1" "$CPU_PCT"
printf 'mem\t%s\t%s\t%s\t%s\n' "$MEM_TOTAL" "$MEM_USED" "$MEM_AVAIL" "$MEM_PCT"
printf 'net\t%s\t%s\t%s\n' "$IFACE" "$RX_BPS" "$TX_BPS"
"#,
    )?;

    parse_system_resources(&output)
}

fn parse_system_resources(output: &str) -> Result<SystemResources, String> {
    let mut cpu: Option<CpuResource> = None;
    let mut memory: Option<MemoryResource> = None;
    let mut network: Option<NetworkResource> = None;

    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0] {
            "cpu" if parts.len() >= 4 => {
                cpu = Some(CpuResource {
                    cores: parts[1].parse().unwrap_or(0),
                    load1: parts[2].parse().unwrap_or(0.0),
                    use_percent: parts[3].parse::<u32>().unwrap_or(0).min(100),
                });
            }
            "mem" if parts.len() >= 5 => {
                let total_bytes = parts[1].parse().unwrap_or(0);
                let used_bytes = parts[2].parse().unwrap_or(0);
                let available_bytes = parts[3].parse().unwrap_or(0);
                let use_percent = parts[4].parse::<u32>().unwrap_or(0).min(100);
                memory = Some(MemoryResource {
                    total_bytes,
                    used_bytes,
                    available_bytes,
                    use_percent,
                });
            }
            "net" if parts.len() >= 4 => {
                network = Some(NetworkResource {
                    interface: parts[1].to_string(),
                    rx_bytes_per_sec: parts[2].parse().unwrap_or(0),
                    tx_bytes_per_sec: parts[3].parse().unwrap_or(0),
                });
            }
            _ => {}
        }
    }

    Ok(SystemResources {
        cpu: cpu.ok_or_else(|| "CPU 정보를 파싱하지 못했습니다.".to_string())?,
        memory: memory.ok_or_else(|| "메모리 정보를 파싱하지 못했습니다.".to_string())?,
        network: network.ok_or_else(|| "네트워크 정보를 파싱하지 못했습니다.".to_string())?,
        memory_pressure: None,
        host: None,
    })
}

#[cfg(test)]
mod tests {
    use super::parse_system_resources;

    #[test]
    fn parses_tab_lines() {
        let sample = "cpu\t8\t1.42\t14\nmem\t1000\t400\t600\t40\nnet\teth0\t100\t50\n";
        let parsed = parse_system_resources(sample).unwrap();
        assert_eq!(parsed.cpu.cores, 8);
        assert!((parsed.cpu.load1 - 1.42).abs() < f64::EPSILON);
        assert_eq!(parsed.cpu.use_percent, 14);
        assert_eq!(parsed.memory.use_percent, 40);
        assert_eq!(parsed.network.interface, "eth0");
        assert_eq!(parsed.network.rx_bytes_per_sec, 100);
    }
}
