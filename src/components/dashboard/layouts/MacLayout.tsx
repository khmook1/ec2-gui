import {
  ComingSoonCard,
  DockerOverviewCard,
  PermissionsCard,
  SshSessionsCard,
  StorageCard,
} from "./SectionCards";
import type { DashboardLayoutProps } from "./types";

/**
 * macOS 원격 호스트용 대시보드.
 * `/proc`·루트 `du` 등 Linux 전용 기능은 제외하고, 공통·Docker만 구성합니다.
 */
export function MacLayout({
  showDocker,
  dockerInstalledPending,
  ...props
}: DashboardLayoutProps) {
  const leftHasSections = showDocker;
  const leftColumnReady = !dockerInstalledPending;
  const showLeftComingSoon = leftColumnReady && !leftHasSections;

  return (
    <div className="dashboard-grid">
      <div className="dashboard-grid__left">
        {showLeftComingSoon ? (
          <ComingSoonCard label="왼쪽 패널 준비 중" />
        ) : null}

        {showDocker ? (
          <DockerOverviewCard
            dockerCounts={props.dockerCounts}
            recentContainers={props.recentContainers}
            dockerLoading={props.dockerLoading}
            dockerError={props.dockerError}
            dockerBadge={props.dockerBadge}
          />
        ) : null}
      </div>

      <div className="dashboard-grid__right">
        <PermissionsCard
          permissions={props.permissions}
          permissionsLoading={props.permissionsLoading}
          permissionError={props.permissionError}
          permissionsBadge={props.permissionsBadge}
        />
        <StorageCard
          filesystems={props.filesystems}
          diskHistory={props.diskHistory}
          diskLoading={props.diskLoading}
          diskHistoryLoading={props.diskHistoryLoading}
          diskError={props.diskError}
          storageBadge={props.storageBadge}
        />
        <SshSessionsCard
          sshSessions={props.sshSessions}
          sshLoading={props.sshLoading}
          sshError={props.sshError}
        />
      </div>
    </div>
  );
}
