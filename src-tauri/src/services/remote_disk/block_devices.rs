use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::thread;
use std::time::Duration;

use super::super::remote_fs::{exec_remote_command, exec_remote_command_checked};
use super::super::remote_permissions::{get_permission_overview, SudoAccess};
use super::detect_remote_os;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockDevice {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    #[serde(rename = "type")]
    pub device_type: String,
    pub mountpoint: Option<String>,
    pub fstype: Option<String>,
    pub pkname: Option<String>,
    pub children: Vec<BlockDevice>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskExpandStatus {
    pub devices: Vec<BlockDevice>,
    pub root_device: Option<String>,
    pub root_partition: Option<String>,
    pub root_fstype: Option<String>,
    pub root_mount: Option<String>,
    pub disk_size_bytes: u64,
    pub unallocated_bytes: u64,
    pub current_size_gb: u64,
    pub volume_id: Option<String>,
    pub instance_id: Option<String>,
    pub region: Option<String>,
    pub can_grow_os: bool,
    pub can_modify_ebs: bool,
    pub requires_sudo: bool,
    pub has_privileged_access: bool,
    pub aws_cli_available: bool,
    pub growpart_available: bool,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskExpandStep {
    pub name: String,
    pub ok: bool,
    pub output: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskExpandResult {
    pub success: bool,
    pub steps: Vec<DiskExpandStep>,
    pub message: String,
}

#[derive(Deserialize)]
struct LsblkRoot {
    blockdevices: Vec<LsblkNode>,
}

#[derive(Deserialize)]
struct LsblkNode {
    name: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    size: serde_json::Value,
    #[serde(default, rename = "type")]
    device_type: Option<String>,
    #[serde(default)]
    mountpoint: Option<serde_json::Value>,
    #[serde(default)]
    fstype: Option<String>,
    #[serde(default)]
    pkname: Option<String>,
    #[serde(default)]
    children: Option<Vec<LsblkNode>>,
}

fn parse_size(value: &serde_json::Value) -> u64 {
    match value {
        serde_json::Value::Number(n) => n.as_u64().unwrap_or(0),
        serde_json::Value::String(s) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

fn parse_mountpoint(value: Option<&serde_json::Value>) -> Option<String> {
    match value {
        Some(serde_json::Value::String(s)) if !s.is_empty() => Some(s.clone()),
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .find_map(|v| v.as_str().map(|s| s.to_string()))
            .filter(|s| !s.is_empty()),
        _ => None,
    }
}

fn convert_node(node: LsblkNode) -> BlockDevice {
    let path = node
        .path
        .filter(|p| !p.is_empty())
        .unwrap_or_else(|| format!("/dev/{}", node.name));
    let children = node
        .children
        .unwrap_or_default()
        .into_iter()
        .map(convert_node)
        .collect();

    BlockDevice {
        name: node.name,
        path,
        size_bytes: parse_size(&node.size),
        device_type: node.device_type.unwrap_or_else(|| "unknown".to_string()),
        mountpoint: parse_mountpoint(node.mountpoint.as_ref()),
        fstype: node.fstype.filter(|s| !s.is_empty()),
        pkname: node.pkname.filter(|s| !s.is_empty()),
        children,
    }
}

fn find_by_mount<'a>(devices: &'a [BlockDevice], mount: &str) -> Option<&'a BlockDevice> {
    for device in devices {
        if device.mountpoint.as_deref() == Some(mount) {
            return Some(device);
        }
        if let Some(found) = find_by_mount(&device.children, mount) {
            return Some(found);
        }
    }
    None
}

fn find_by_name<'a>(devices: &'a [BlockDevice], name: &str) -> Option<&'a BlockDevice> {
    for device in devices {
        if device.name == name {
            return Some(device);
        }
        if let Some(found) = find_by_name(&device.children, name) {
            return Some(found);
        }
    }
    None
}

fn parent_disk<'a>(devices: &'a [BlockDevice], partition: &BlockDevice) -> Option<&'a BlockDevice> {
    if let Some(pk) = partition.pkname.as_deref() {
        if let Some(found) = find_by_name(devices, pk) {
            if found.device_type == "disk" {
                return Some(found);
            }
            return parent_disk(devices, found);
        }
    }

    // pkname 없을 때: 파티션이 disk children에 속하는지 탐색
    for disk in devices {
        if disk.device_type != "disk" {
            continue;
        }
        if disk.children.iter().any(|c| c.name == partition.name) {
            return Some(disk);
        }
        for child in &disk.children {
            if child.children.iter().any(|c| c.name == partition.name) {
                return Some(disk);
            }
        }
    }
    None
}

fn sum_children_size(disk: &BlockDevice) -> u64 {
    disk.children.iter().map(|c| c.size_bytes).sum()
}

fn bytes_to_gib(bytes: u64) -> u64 {
    (bytes + (1024 * 1024 * 1024) - 1) / (1024 * 1024 * 1024)
}

fn partition_number(partition_name: &str, disk_name: &str) -> Option<u32> {
    if !partition_name.starts_with(disk_name) {
        return None;
    }
    let rest = &partition_name[disk_name.len()..];
    if rest.starts_with('p') {
        return rest[1..].parse().ok();
    }
    if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()) {
        return rest.parse().ok();
    }
    None
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn command_available(session: &Session, name: &str) -> bool {
    exec_remote_command(session, &format!("command -v {} >/dev/null 2>&1 && echo yes", name))
        .map(|out| out.trim() == "yes")
        .unwrap_or(false)
}

fn fetch_imds(session: &Session, path: &str) -> Option<String> {
    let script = format!(
        r#"
set +e
TOKEN=$(curl -sS -m 2 -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  curl -sS -m 2 -H "X-aws-ec2-metadata-token: $TOKEN" \
    "http://169.254.169.254/latest/meta-data/{path}" 2>/dev/null
else
  curl -sS -m 2 "http://169.254.169.254/latest/meta-data/{path}" 2>/dev/null
fi
"#
    );
    exec_remote_command(session, &script)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !s.contains("Not Found") && !s.contains("404"))
}

fn detect_volume_id(session: &Session, disk_name: &str) -> Option<String> {
    // NVMe EBS: /dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_volXXXXXXXX
    let script = format!(
        r#"
set +e
DISK={disk}
for link in /dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_vol*; do
  [ -e "$link" ] || continue
  target=$(readlink -f "$link" 2>/dev/null || true)
  base=$(basename "$target" 2>/dev/null || true)
  if [ "$base" = "$DISK" ]; then
    id=$(basename "$link" | sed -n 's/.*vol\([a-zA-Z0-9]*\).*/vol-\1/p')
    if [ -n "$id" ]; then
      printf '%s' "$id"
      exit 0
    fi
  fi
done
serial=$(lsblk -ndo SERIAL "/dev/$DISK" 2>/dev/null | head -n1 | tr -d '[:space:]')
case "$serial" in
  vol*) printf 'vol-%s' "${{serial#vol}}" ;;
esac
"#,
        disk = shell_quote(disk_name),
    );
    exec_remote_command(session, &script)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| s.starts_with("vol-") && s.len() > 4)
}

fn resolve_volume_id_via_aws(
    session: &Session,
    instance_id: &str,
    region: &str,
    disk_name: &str,
) -> Option<String> {
    let script = format!(
        r#"
set +e
REGION={region}
INSTANCE={instance}
DISK={disk}
aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE" \
  --query 'Reservations[0].Instances[0].BlockDeviceMappings[*].[DeviceName,Ebs.VolumeId]' \
  --output text 2>/dev/null | while read -r device volume; do
  [ -z "$volume" ] && continue
  # NVMe: /dev/sda1 -> /dev/nvme0n1 매핑은 어렵므로 root 우선
  if [ "$device" = "/dev/sda1" ] || [ "$device" = "/dev/xvda1" ] || [ "$device" = "/dev/nvme0n1p1" ]; then
    printf '%s' "$volume"
    exit 0
  fi
done
# 첫 번째 EBS 볼륨 fallback
aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE" \
  --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' \
  --output text 2>/dev/null | tr -d '[:space:]'
"#,
        region = shell_quote(region),
        instance = shell_quote(instance_id),
        disk = shell_quote(disk_name),
    );
    exec_remote_command(session, &script)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| s.starts_with("vol-") && !s.contains("None") && !s.contains("error"))
}

/// Linux `lsblk -J` 블록 디바이스 트리.
pub fn list_block_devices(session: &Session) -> Result<Vec<BlockDevice>, String> {
    if detect_remote_os(session) != "linux" {
        return Err("블록 디바이스 목록은 Linux에서만 지원합니다.".to_string());
    }

    let output = exec_remote_command(
        session,
        "lsblk -J -b -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,PKNAME,PATH 2>/dev/null",
    )?;

    if output.trim().is_empty() {
        return Err("lsblk 결과가 비어 있습니다.".to_string());
    }

    let parsed: LsblkRoot = serde_json::from_str(&output)
        .map_err(|e| format!("lsblk JSON 파싱 실패: {e}"))?;

    Ok(parsed.blockdevices.into_iter().map(convert_node).collect())
}

/// 루트 디스크 확장 가능 여부·미할당·EBS 메타.
pub fn get_expand_status(session: &Session) -> Result<DiskExpandStatus, String> {
    if detect_remote_os(session) != "linux" {
        return Err("디스크 확장은 Linux에서만 지원합니다.".to_string());
    }

    let devices = list_block_devices(session)?;
    let permissions = get_permission_overview(session)?;
    let has_privileged = matches!(
        permissions.sudo,
        SudoAccess::Root | SudoAccess::Passwordless
    ) || permissions.is_root;
    let requires_sudo = !permissions.is_root;

    let aws_cli_available = command_available(session, "aws");
    let growpart_available = command_available(session, "growpart");

    let mut notes = Vec::new();
    let root = find_by_mount(&devices, "/");
    let (
        root_device,
        root_partition,
        root_fstype,
        root_mount,
        disk_size_bytes,
        unallocated_bytes,
        current_size_gb,
        mut volume_id,
    ) = if let Some(part) = root {
        let disk = parent_disk(&devices, part);
        let disk_size = disk.map(|d| d.size_bytes).unwrap_or(part.size_bytes);
        let children_sum = disk.map(sum_children_size).unwrap_or(0);
        let unallocated = disk_size.saturating_sub(children_sum);
        let disk_name = disk.map(|d| d.name.clone());
        let vol = disk_name
            .as_deref()
            .and_then(|name| detect_volume_id(session, name));

        (
            disk_name,
            Some(part.name.clone()),
            part.fstype.clone(),
            part.mountpoint.clone(),
            disk_size,
            unallocated,
            bytes_to_gib(disk_size).max(1),
            vol,
        )
    } else {
        notes.push("루트(/) 마운트 파티션을 찾지 못했습니다.".to_string());
        (None, None, None, None, 0, 0, 0, None)
    };

    let instance_id = fetch_imds(session, "instance-id");
    let region = fetch_imds(session, "placement/region").or_else(|| {
        fetch_imds(session, "placement/availability-zone").map(|az| {
            let trimmed = az.trim();
            if trimmed.len() > 1
                && trimmed
                    .chars()
                    .last()
                    .map(|c| c.is_ascii_lowercase())
                    .unwrap_or(false)
            {
                trimmed[..trimmed.len() - 1].to_string()
            } else {
                trimmed.to_string()
            }
        })
    });

    if volume_id.is_none() {
        if let (Some(ref iid), Some(ref reg), Some(ref disk)) =
            (&instance_id, &region, &root_device)
        {
            if aws_cli_available {
                volume_id = resolve_volume_id_via_aws(session, iid, reg, disk);
            }
        }
    }

    let can_grow_os = unallocated_bytes > (16 * 1024 * 1024) // >16MiB
        && root_partition.is_some()
        && growpart_available;

    let can_modify_ebs = aws_cli_available && volume_id.is_some() && region.is_some();

    if !has_privileged {
        notes.push("확장에는 root 또는 passwordless sudo가 필요합니다.".to_string());
    }
    if !growpart_available {
        notes.push("growpart(cloud-guest-utils)가 설치되어 있지 않습니다.".to_string());
    }
    if !aws_cli_available {
        notes.push("aws CLI가 없어 EBS ModifyVolume을 실행할 수 없습니다.".to_string());
    }
    if volume_id.is_none() {
        notes.push("EBS 볼륨 ID를 확인하지 못했습니다.".to_string());
    }

    Ok(DiskExpandStatus {
        devices,
        root_device,
        root_partition,
        root_fstype,
        root_mount,
        disk_size_bytes,
        unallocated_bytes,
        current_size_gb,
        volume_id,
        instance_id,
        region,
        can_grow_os,
        can_modify_ebs,
        requires_sudo,
        has_privileged_access: has_privileged,
        aws_cli_available,
        growpart_available,
        notes,
    })
}

fn run_step(
    session: &Session,
    name: &str,
    command: &str,
    steps: &mut Vec<DiskExpandStep>,
) -> Result<(), String> {
    match exec_remote_command_checked(session, command) {
        Ok(output) => {
            steps.push(DiskExpandStep {
                name: name.to_string(),
                ok: true,
                output: if output.is_empty() {
                    "(ok)".to_string()
                } else {
                    output
                },
            });
            Ok(())
        }
        Err(err) => {
            steps.push(DiskExpandStep {
                name: name.to_string(),
                ok: false,
                output: err.clone(),
            });
            Err(err)
        }
    }
}

fn wait_volume_modification(
    session: &Session,
    region: &str,
    volume_id: &str,
    steps: &mut Vec<DiskExpandStep>,
) -> Result<(), String> {
    // 최대 ~10분 (5초 × 120)
    for attempt in 1..=120 {
        let cmd = format!(
            r#"aws ec2 describe-volumes-modifications --region {region} --volume-ids {volume} \
  --query 'VolumesModifications[0].ModificationState' --output text 2>/dev/null"#,
            region = shell_quote(region),
            volume = shell_quote(volume_id),
        );
        let state = exec_remote_command(session, &cmd)
            .unwrap_or_default()
            .trim()
            .to_string();

        if state == "completed" || state == "optimizing" {
            steps.push(DiskExpandStep {
                name: "EBS 수정 대기".to_string(),
                ok: true,
                output: format!("state={state} (attempt {attempt})"),
            });
            return Ok(());
        }
        if state == "failed" {
            let msg = format!("EBS 볼륨 수정 실패 (state={state})");
            steps.push(DiskExpandStep {
                name: "EBS 수정 대기".to_string(),
                ok: false,
                output: msg.clone(),
            });
            return Err(msg);
        }
        if state == "None" || state.is_empty() {
            // 아직 반영 전일 수 있음 — 잠시 대기
        }
        thread::sleep(Duration::from_secs(5));
    }

    let msg = "EBS 볼륨 수정 완료 대기 시간 초과".to_string();
    steps.push(DiskExpandStep {
        name: "EBS 수정 대기".to_string(),
        ok: false,
        output: msg.clone(),
    });
    Err(msg)
}

fn grow_os_filesystem(
    session: &Session,
    status: &DiskExpandStatus,
    prefix: &str,
    steps: &mut Vec<DiskExpandStep>,
) -> Result<(), String> {
    let disk = status
        .root_device
        .as_deref()
        .ok_or_else(|| "루트 디스크를 찾을 수 없습니다.".to_string())?;
    let part = status
        .root_partition
        .as_deref()
        .ok_or_else(|| "루트 파티션을 찾을 수 없습니다.".to_string())?;
    let part_num = partition_number(part, disk)
        .ok_or_else(|| format!("파티션 번호를 파싱할 수 없습니다: {part}"))?;

    let grow_cmd = format!(
        "{prefix}growpart /dev/{disk} {part_num}",
        disk = disk,
        part_num = part_num,
        prefix = prefix,
    );
    // growpart는 이미 최대일 때 exit 1 + "NOCHANGE" — 성공으로 처리
    match exec_remote_command_checked(session, &grow_cmd) {
        Ok(output) => {
            steps.push(DiskExpandStep {
                name: "growpart".to_string(),
                ok: true,
                output: if output.is_empty() {
                    "CHANGED".to_string()
                } else {
                    output
                },
            });
        }
        Err(err) if err.contains("NOCHANGE") || err.to_uppercase().contains("NOCHANGE") => {
            steps.push(DiskExpandStep {
                name: "growpart".to_string(),
                ok: true,
                output: err,
            });
        }
        Err(err) => {
            steps.push(DiskExpandStep {
                name: "growpart".to_string(),
                ok: false,
                output: err.clone(),
            });
            return Err(err);
        }
    }

    let fstype = status.root_fstype.as_deref().unwrap_or("").to_ascii_lowercase();
    let mount = status.root_mount.as_deref().unwrap_or("/");
    let part_path = format!("/dev/{part}");

    if fstype.contains("xfs") {
        run_step(
            session,
            "xfs_growfs",
            &format!("{prefix}xfs_growfs {}", shell_quote(mount)),
            steps,
        )?;
    } else {
        // ext2/3/4 및 기타 → resize2fs
        run_step(
            session,
            "resize2fs",
            &format!("{prefix}resize2fs {}", shell_quote(&part_path)),
            steps,
        )?;
    }

    Ok(())
}

/// EBS ModifyVolume(선택) + growpart + 파일시스템 확장.
pub fn expand_disk(session: &Session, target_size_gb: Option<u64>) -> Result<DiskExpandResult, String> {
    if detect_remote_os(session) != "linux" {
        return Err("디스크 확장은 Linux에서만 지원합니다.".to_string());
    }

    let mut steps = Vec::new();
    let status = get_expand_status(session)?;

    if !status.has_privileged_access {
        return Ok(DiskExpandResult {
            success: false,
            steps,
            message: "passwordless sudo 또는 root 권한이 필요합니다.".to_string(),
        });
    }

    let prefix = if status.requires_sudo {
        "sudo -n "
    } else {
        ""
    };

    let current_gb = status.current_size_gb.max(1);
    let wants_ebs = match target_size_gb {
        Some(target) if target > current_gb => Some(target),
        Some(target) if target < current_gb => {
            return Ok(DiskExpandResult {
                success: false,
                steps,
                message: "EBS 축소는 지원하지 않습니다. 현재 크기 이상으로 지정하세요.".to_string(),
            });
        }
        Some(_) => None, // same size → OS grow only
        None => None,
    };

    if let Some(target) = wants_ebs {
        if !status.can_modify_ebs {
            return Ok(DiskExpandResult {
                success: false,
                steps,
                message: "EBS 확장을 할 수 없습니다. aws CLI·볼륨 ID·리전·IAM을 확인하세요."
                    .to_string(),
            });
        }
        let volume_id = status.volume_id.as_deref().unwrap();
        let region = status.region.as_deref().unwrap();

        let modify_cmd = format!(
            "aws ec2 modify-volume --region {region} --volume-id {volume} --size {size}",
            region = shell_quote(region),
            volume = shell_quote(volume_id),
            size = target,
        );
        if let Err(err) = run_step(session, "ModifyVolume", &modify_cmd, &mut steps) {
            return Ok(DiskExpandResult {
                success: false,
                steps,
                message: format!("EBS ModifyVolume 실패: {err}"),
            });
        }

        if let Err(err) = wait_volume_modification(session, region, volume_id, &mut steps) {
            return Ok(DiskExpandResult {
                success: false,
                steps,
                message: err,
            });
        }

        // 커널이 새 크기를 인식하도록 잠시 대기 후 재조회
        thread::sleep(Duration::from_secs(2));
        let _ = exec_remote_command(
            session,
            &format!(
                "{prefix}bash -c 'echo 1 > /sys/block/{}/device/rescan 2>/dev/null || true'",
                status.root_device.as_deref().unwrap_or("nvme0n1")
            ),
        );
        thread::sleep(Duration::from_secs(2));
    } else if status.unallocated_bytes < 16 * 1024 * 1024 && wants_ebs.is_none() {
        // 미할당도 없고 EBS도 안 키움
        if target_size_gb.is_none() || target_size_gb == Some(current_gb) {
            // still try growpart in case of race — but warn if no unallocated
            if !status.can_grow_os {
                return Ok(DiskExpandResult {
                    success: false,
                    steps,
                    message: "할당할 미사용 디스크 공간이 없습니다. 목표 용량(GiB)을 더 크게 지정하세요."
                        .to_string(),
                });
            }
        }
    }

    // 최신 상태로 다시 읽어 grow
    let status_after = get_expand_status(session).unwrap_or(status);
    if let Err(err) = grow_os_filesystem(session, &status_after, prefix, &mut steps) {
        return Ok(DiskExpandResult {
            success: false,
            steps,
            message: format!("OS 파일시스템 확장 실패: {err}"),
        });
    }

    Ok(DiskExpandResult {
        success: true,
        steps,
        message: "디스크 확장이 완료되었습니다.".to_string(),
    })
}
