import {
  pickPrimaryFilesystem,
  toneForPercent,
} from "@/components/dashboard/utils/diskUi";
import {
  InfoPanel,
  type InfoPanelTone,
} from "@/components/dashboard/atoms/InfoPanel";
import type { DockerOverviewCounts } from "@/components/dashboard/DockerOverviewSection";
import type { DiskFilesystem } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import { formatLabel } from "@/utils/format";
import "./css/dashboard.css";

interface DashboardSummaryProps {
  appReady: boolean;
  filesystems: DiskFilesystem[];
  dockerCounts: DockerOverviewCounts | null;
  sshSessionCount: number;
  loading: boolean;
}

function toPanelTone(tone: ReturnType<typeof toneForPercent>): InfoPanelTone {
  if (tone === "neutral") {
    return "neutral";
  }
  return tone;
}

export function DashboardSummary({
  appReady,
  filesystems,
  dockerCounts,
  sshSessionCount,
  loading,
}: DashboardSummaryProps) {
  const primary = pickPrimaryFilesystem(filesystems);
  const diskTone = primary
    ? toPanelTone(toneForPercent(primary.usePercent))
    : "neutral";
  const running = dockerCounts?.containers.running ?? 0;
  const total = dockerCounts?.containers.total ?? 0;
  const stopped = dockerCounts?.containers.stopped ?? 0;
  const dockerTone: InfoPanelTone =
    !loading && dockerCounts
      ? running > 0
        ? "success"
        : total > 0
          ? "warning"
          : "neutral"
      : "accent";

  return (
    <section className="dashboard-metrics" aria-label="핵심 지표">
      <InfoPanel
        title="서버 상태"
        value={appReady ? "정상" : "확인 중"}
        description={appReady ? "앱 연결 정상" : "호스트 상태 확인 중"}
        tone={appReady ? "success" : "warning"}
        loading={loading}
      />
      <InfoPanel
        title="디스크 사용률"
        value={primary ? `${primary.usePercent}%` : "—"}
        description={
          primary
            ? `${formatFileSize(primary.usedBytes)} 사용 · ${formatFileSize(primary.availableBytes)} 여유`
            : "디스크 정보 대기 중"
        }
        tone={diskTone === "success" ? "accent" : diskTone}
        loading={loading}
      />
      <InfoPanel
        title="Docker 컨테이너"
        value={dockerCounts ? `${running}` : "—"}
        description={
          dockerCounts
            ? `실행 ${running} · 중지 ${stopped} · 전체 ${total}`
            : "Docker 정보 대기 중"
        }
        tone={dockerTone}
        loading={loading}
      />
      <InfoPanel
        title="SSH 세션"
        value={String(sshSessionCount)}
        description={
          sshSessionCount > 0
            ? `원격 로그인 ${sshSessionCount}개`
            : "원격 로그인 없음"
        }
        tone="accent"
        loading={loading}
      />
    </section>
  );
}

export function formatAppLabels(
  name: string | undefined,
  version: string | undefined,
) {
  return {
    appName: formatLabel(name),
    appVersion: formatLabel(version),
  };
}
