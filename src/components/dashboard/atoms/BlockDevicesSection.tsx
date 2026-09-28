import type { BlockDevice } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import "../css/dashboard.css";

interface BlockDevicesSectionProps {
  devices: BlockDevice[];
  loading: boolean;
  error: string | null;
  onExpand?: () => void;
}

function DeviceRow({
  device,
  depth,
}: {
  device: BlockDevice;
  depth: number;
}) {
  return (
    <>
      <li
        className="dashboard-block-devices__row"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <span className="dashboard-block-devices__name" title={device.path}>
          {device.name}
        </span>
        <span className="dashboard-block-devices__type">{device.type}</span>
        <span className="dashboard-block-devices__size">
          {formatFileSize(device.sizeBytes)}
        </span>
        <span className="dashboard-block-devices__mount">
          {device.mountpoint ?? device.fstype ?? "—"}
        </span>
      </li>
      {device.children.map((child) => (
        <DeviceRow key={child.path || child.name} device={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function BlockDevicesSection({
  devices,
  loading,
  error,
  onExpand,
}: BlockDevicesSectionProps) {
  if (loading) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__row dashboard-skeleton__row--short" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        className="dashboard-section__status dashboard-section__status--error"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (devices.length === 0) {
    return (
      <p className="dashboard-section__status" role="status">
        표시할 블록 디바이스가 없습니다.
      </p>
    );
  }

  return (
    <div className="dashboard-block-devices">
      <div className="dashboard-block-devices__toolbar">
        <span className="dashboard-block-devices__hint">lsblk</span>
        {onExpand ? (
          <button
            type="button"
            className="dashboard-block-devices__action"
            onClick={onExpand}
          >
            용량 확장
          </button>
        ) : null}
      </div>
      <ul className="dashboard-block-devices__list" aria-label="블록 디바이스">
        <li className="dashboard-block-devices__header" aria-hidden="true">
          <span>이름</span>
          <span>유형</span>
          <span>크기</span>
          <span>마운트/FS</span>
        </li>
        {devices.map((device) => (
          <DeviceRow key={device.path || device.name} device={device} depth={0} />
        ))}
      </ul>
    </div>
  );
}
