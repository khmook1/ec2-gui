use ssh2::Session;

use super::{
    CpuResource, HostInfo, MemoryPressureInfo, MemoryResource, NetworkResource, SystemResources,
};
use super::super::remote_fs::exec_remote_command;

/// macOS: sysctl / vm_stat / memory_pressure / netstat 기반 스냅샷.
pub fn get_system_resources(session: &Session) -> Result<SystemResources, String> {
    let output = exec_remote_command(
        session,
        r#"
set +e

CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 1)
LOAD1=$(sysctl -n vm.loadavg 2>/dev/null | awk '{gsub(/[{}]/,""); print $1}')
[ -z "$LOAD1" ] && LOAD1=0

# kern.cp_time: user nice sys idle ...
read_cpu() { sysctl -n kern.cp_time 2>/dev/null; }
read U1 N1 S1 I1 _ <<EOF
$(read_cpu)
EOF

# 기본 라우트 인터페이스 + 바이트 카운터 (netstat -ib)
IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')
[ -z "$IFACE" ] && IFACE=$(netstat -ibn 2>/dev/null | awk 'NR>1 && $1!="lo0" && $1!~/\*/ {print $1; exit}')
[ -z "$IFACE" ] && IFACE="—"

read_net() {
  netstat -ibn 2>/dev/null | awk -v iface="$IFACE" '
    NR>1 {
      name=$1; gsub(/\*/,"",name);
      if (name==iface) { print $7+0, $10+0; exit }
    }
  '
}
read R1 T1 <<EOF
$(read_net)
EOF
[ -z "$R1" ] && R1=0
[ -z "$T1" ] && T1=0

sleep 0.3

read U2 N2 S2 I2 _ <<EOF
$(read_cpu)
EOF
read R2 T2 <<EOF
$(read_net)
EOF
[ -z "$R2" ] && R2=0
[ -z "$T2" ] && T2=0

DU=$((U2 - U1)); DN=$((N2 - N1)); DS=$((S2 - S1)); DI=$((I2 - I1))
DT=$((DU + DN + DS + DI))
if [ "$DT" -gt 0 ]; then
  CPU_PCT=$(( (100 * (DU + DN + DS)) / DT ))
else
  CPU_PCT=0
fi
[ "$CPU_PCT" -lt 0 ] && CPU_PCT=0
[ "$CPU_PCT" -gt 100 ] && CPU_PCT=100

MEM_TOTAL=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
# memory_pressure는 수 초~수십 초 걸릴 수 있어 vm_stat만 사용
PAGE=$(pagesize 2>/dev/null || echo 4096)
VM=$(vm_stat 2>/dev/null)
FREE_P=$(printf '%s\n' "$VM" | awk '/Pages free/ {gsub(/\./,"",$3); print $3+0}')
ACT_P=$(printf '%s\n' "$VM" | awk '/Pages active/ {gsub(/\./,"",$3); print $3+0}')
INACT_P=$(printf '%s\n' "$VM" | awk '/Pages inactive/ {gsub(/\./,"",$3); print $3+0}')
WIRED_P=$(printf '%s\n' "$VM" | awk '/Pages wired/ {gsub(/\./,"",$4); print $4+0}')
COMP_P=$(printf '%s\n' "$VM" | awk '/occupied by compressor/ {gsub(/\./,"",$5); print $5+0}')
SPEC_P=$(printf '%s\n' "$VM" | awk '/Pages speculative/ {gsub(/\./,"",$3); print $3+0}')
[ -z "$FREE_P" ] && FREE_P=0
[ -z "$ACT_P" ] && ACT_P=0
[ -z "$INACT_P" ] && INACT_P=0
[ -z "$WIRED_P" ] && WIRED_P=0
[ -z "$COMP_P" ] && COMP_P=0
[ -z "$SPEC_P" ] && SPEC_P=0
MEM_USED=$(( (ACT_P + WIRED_P + COMP_P) * PAGE ))
MEM_AVAIL=$(( (FREE_P + INACT_P + SPEC_P) * PAGE ))
if [ "$MEM_TOTAL" -gt 0 ]; then
  MEM_PCT=$(( (100 * MEM_USED) / MEM_TOTAL ))
  [ "$MEM_PCT" -gt 100 ] && MEM_PCT=100
  FREE_PCT=$(( 100 - MEM_PCT ))
else
  MEM_PCT=0
  FREE_PCT=0
fi
if [ "$FREE_PCT" -ge 40 ]; then
  PRESSURE=normal
elif [ "$FREE_PCT" -ge 20 ]; then
  PRESSURE=warn
else
  PRESSURE=critical
fi

RX_BPS=$(( (R2 - R1) * 10 / 3 ))
TX_BPS=$(( (T2 - T1) * 10 / 3 ))
[ "$RX_BPS" -lt 0 ] && RX_BPS=0
[ "$TX_BPS" -lt 0 ] && TX_BPS=0

MODEL=$(sysctl -n hw.model 2>/dev/null || echo unknown)
OSVER=$(sw_vers -productVersion 2>/dev/null || echo unknown)
BOOT=$(sysctl -n kern.boottime 2>/dev/null | sed -nE 's/.*sec = ([0-9]+).*/\1/p')
NOW=$(date +%s)
if [ -n "$BOOT" ] && [ "$NOW" -gt "$BOOT" ]; then
  UPTIME=$((NOW - BOOT))
else
  UPTIME=0
fi

printf 'cpu\t%s\t%s\t%s\n' "$CORES" "$LOAD1" "$CPU_PCT"
printf 'mem\t%s\t%s\t%s\t%s\n' "$MEM_TOTAL" "$MEM_USED" "$MEM_AVAIL" "$MEM_PCT"
printf 'net\t%s\t%s\t%s\n' "$IFACE" "$RX_BPS" "$TX_BPS"
printf 'pressure\t%s\t%s\n' "$PRESSURE" "$FREE_PCT"
printf 'host\t%s\t%s\t%s\n' "$MODEL" "$OSVER" "$UPTIME"
"#,
    )?;

    parse_system_resources(&output)
}

fn parse_system_resources(output: &str) -> Result<SystemResources, String> {
    let mut cpu: Option<CpuResource> = None;
    let mut memory: Option<MemoryResource> = None;
    let mut network: Option<NetworkResource> = None;
    let mut memory_pressure: Option<MemoryPressureInfo> = None;
    let mut host: Option<HostInfo> = None;

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
                memory = Some(MemoryResource {
                    total_bytes: parts[1].parse().unwrap_or(0),
                    used_bytes: parts[2].parse().unwrap_or(0),
                    available_bytes: parts[3].parse().unwrap_or(0),
                    use_percent: parts[4].parse::<u32>().unwrap_or(0).min(100),
                });
            }
            "net" if parts.len() >= 4 => {
                network = Some(NetworkResource {
                    interface: parts[1].to_string(),
                    rx_bytes_per_sec: parts[2].parse().unwrap_or(0),
                    tx_bytes_per_sec: parts[3].parse().unwrap_or(0),
                });
            }
            "pressure" if parts.len() >= 2 => {
                let free_percent = parts
                    .get(2)
                    .filter(|s| !s.is_empty())
                    .and_then(|s| s.parse().ok());
                memory_pressure = Some(MemoryPressureInfo {
                    level: parts[1].to_string(),
                    free_percent,
                });
            }
            "host" if parts.len() >= 4 => {
                host = Some(HostInfo {
                    model: parts[1].to_string(),
                    os_version: parts[2].to_string(),
                    uptime_seconds: parts[3].parse().unwrap_or(0),
                });
            }
            _ => {}
        }
    }

    Ok(SystemResources {
        cpu: cpu.ok_or_else(|| "CPU 정보를 파싱하지 못했습니다.".to_string())?,
        memory: memory.ok_or_else(|| "메모리 정보를 파싱하지 못했습니다.".to_string())?,
        network: network.ok_or_else(|| "네트워크 정보를 파싱하지 못했습니다.".to_string())?,
        memory_pressure,
        host,
    })
}

#[cfg(test)]
mod tests {
    use super::parse_system_resources;

    #[test]
    fn parses_macos_tab_lines() {
        let sample = "\
cpu\t8\t1.20\t22\n\
mem\t1000\t400\t600\t40\n\
net\ten0\t100\t50\n\
pressure\twarn\t35\n\
host\tMac15,6\t15.1\t3600\n";
        let parsed = parse_system_resources(sample).unwrap();
        assert_eq!(parsed.cpu.cores, 8);
        assert_eq!(parsed.memory.use_percent, 40);
        assert_eq!(parsed.network.interface, "en0");
        let pressure = parsed.memory_pressure.unwrap();
        assert_eq!(pressure.level, "warn");
        assert_eq!(pressure.free_percent, Some(35));
        let host = parsed.host.unwrap();
        assert_eq!(host.model, "Mac15,6");
        assert_eq!(host.os_version, "15.1");
        assert_eq!(host.uptime_seconds, 3600);
    }
}
