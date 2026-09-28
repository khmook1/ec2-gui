import { Button } from "@/components/common/Button";
import { formatFileSize } from "@/utils/file";
import type { DiskFilesystem } from "@/types/disk";
import "./css/dashboard.css";

interface DiskLowAlertBannerProps {
  filesystem: DiskFilesystem;
  onExpand?: () => void;
}

/** 용량 부족(≥90%) 시 대시보드 상단에 고정 표시되는 헤더형 알림 */
export function DiskLowAlertBanner({
  filesystem,
  onExpand,
}: DiskLowAlertBannerProps) {
  return (
    <div
      className="dashboard-disk-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="dashboard-disk-banner__copy">
        <strong className="dashboard-disk-banner__title">디스크 용량 부족</strong>
        <span className="dashboard-disk-banner__detail">
          {filesystem.mountedOn} {filesystem.usePercent}% ·{" "}
          {formatFileSize(filesystem.usedBytes)} /{" "}
          {formatFileSize(filesystem.sizeBytes)}
        </span>
      </div>
      {onExpand ? (
        <Button type="button" onClick={onExpand}>
          용량 확장
        </Button>
      ) : null}
    </div>
  );
}
