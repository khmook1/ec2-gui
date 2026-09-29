import { pickPrimaryFilesystem } from "@/components/dashboard/utils/diskUi";
import { InfoPanel } from "@/components/dashboard/atoms/InfoPanel";
import {
  DockerSectionIcon,
  SshSessionsSectionIcon,
  StorageSectionIcon,
} from "@/components/icons/DashboardSectionIcons";
import type { DockerOverviewCounts } from "@/components/dashboard/DockerOverviewSection";
import type { DiskFilesystem, RemoteOs } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import { formatLabel } from "@/utils/format";
import "./css/dashboard.css";

interface DashboardSummaryProps {
  filesystems: DiskFilesystem[];
  dockerCounts: DockerOverviewCounts | null;
  sshSessionCount: number;
  loading: boolean;
  showDocker?: boolean;
  os?: RemoteOs | null;
}

export function DashboardSummary({
  filesystems,
  dockerCounts,
  sshSessionCount,
  loading,
  showDocker = true,
  os,
}: DashboardSummaryProps) {
  const primary = pickPrimaryFilesystem(filesystems, os);
  const running = dockerCounts?.containers.running ?? 0;
  const total = dockerCounts?.containers.total ?? 0;
  const stopped = dockerCounts?.containers.stopped ?? 0;

  return (
    <section
      className={
        showDocker
          ? "dashboard-metrics"
          : "dashboard-metrics dashboard-metrics--no-docker"
      }
      aria-label="핵심 지표"
    >
      <InfoPanel
        title="디스크 사용률"
        icon={<StorageSectionIcon />}
        value={primary ? `${primary.usePercent}%` : "—"}
        description={
          primary
            ? `${formatFileSize(primary.usedBytes)} 사용 · ${formatFileSize(primary.availableBytes)} 여유`
            : "디스크 정보 대기 중"
        }
        loading={loading}
      />
      {showDocker ? (
        <InfoPanel
          title="Docker 컨테이너"
          icon={<DockerSectionIcon />}
          value={dockerCounts ? `${running}` : "—"}
          description={
            dockerCounts
              ? `실행 ${running} · 중지 ${stopped} · 전체 ${total}`
              : "Docker 정보 대기 중"
          }
          loading={loading}
        />
      ) : null}
      <InfoPanel
        title="SSH 세션"
        icon={<SshSessionsSectionIcon />}
        value={String(sshSessionCount)}
        description={
          sshSessionCount > 0
            ? `원격 로그인 ${sshSessionCount}개`
            : "원격 로그인 없음"
        }
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
