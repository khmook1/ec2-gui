import { InfoPanel } from "@/components/dashboard/InfoPanel";
import {
  formatDiskUsageLine,
  pickPrimaryFilesystem,
  toneForPercent,
} from "@/components/dashboard/diskUi";
import type { DiskFilesystem } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import { formatLabel } from "@/utils/format";
import "./css/dashboard.css";

interface DashboardSummaryProps {
  appName: string;
  appVersion: string;
  appReady: boolean;
  filesystems: DiskFilesystem[];
  loading: boolean;
}

export function DashboardSummary({
  appName,
  appVersion,
  appReady,
  filesystems,
  loading,
}: DashboardSummaryProps) {
  const primary = pickPrimaryFilesystem(filesystems);
  const tone = primary ? toneForPercent(primary.usePercent) : "neutral";
  const panelTone =
    tone === "danger" || tone === "warning"
      ? "warning"
      : tone === "success"
        ? "success"
        : "accent";
  const usageValue = loading
    ? "…"
    : primary
      ? `${primary.usePercent}%`
      : "—";
  const usedValue = loading
    ? "…"
    : primary
      ? formatDiskUsageLine(primary)
      : "—";
  const freeValue = loading
    ? "…"
    : primary
      ? formatFileSize(primary.availableBytes)
      : "—";

  return (
    <section className="dashboard-summary" aria-label="요약">
      <InfoPanel
        tone="neutral"
        title="앱 정보"
        value={appName}
        description={
          <>
            버전 {appVersion} · Tauri {appReady ? "정상" : "확인 중"}
          </>
        }
      />
      <InfoPanel
        tone={panelTone}
        title="루트 사용률"
        value={usageValue}
        description={
          primary
            ? `${primary.mountedOn} · ${primary.filesystem}`
            : "디스크 정보 대기 중"
        }
      />
      <InfoPanel
        tone="accent"
        title="사용 / 전체"
        value={usedValue}
        description={primary ? `마운트 ${primary.mountedOn}` : "—"}
      />
      <InfoPanel
        tone="success"
        title="여유 공간"
        value={freeValue}
        description={
          primary
            ? `전체 ${formatFileSize(primary.sizeBytes)} 중 사용 가능`
            : "—"
        }
      />
    </section>
  );
}

export function formatAppLabels(name: string | undefined, version: string | undefined) {
  return {
    appName: formatLabel(name),
    appVersion: formatLabel(version),
  };
}
