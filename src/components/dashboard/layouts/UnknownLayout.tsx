import {
  ComingSoonCard,
  DockerOverviewCard,
  PermissionsCard,
  SshSessionsCard,
  StorageCard,
} from "./SectionCards";
import type { DashboardLayoutProps } from "./types";

/**
 * OS를 아직 알 수 없거나 미지원일 때 쓰는 폴백 레이아웃.
 * 공통 섹션만 노출합니다.
 */
export function UnknownLayout({
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
          os={props.os}
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
