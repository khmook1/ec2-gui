import {
  DockerOverviewCard,
  LargeDirectoriesCard,
  PermissionsCard,
  SshSessionsCard,
  StorageCard,
  SystemResourcesCard,
} from "./SectionCards";
import type { DashboardLayoutProps } from "./types";

/**
 * Linux 원격 호스트용 대시보드.
 * `/proc` 시스템 리소스 · 루트 `du` 대용량 디렉터리 등 Linux 전용 명령을 포함합니다.
 */
export function LinuxLayout({
  showDocker,
  ...props
}: DashboardLayoutProps) {
  return (
    <div className="dashboard-grid">
      <div className="dashboard-grid__left">
        <SystemResourcesCard
          systemResources={props.systemResources}
          systemLoading={props.systemLoading}
          systemError={props.systemError}
        />

        {showDocker ? (
          <DockerOverviewCard
            dockerCounts={props.dockerCounts}
            recentContainers={props.recentContainers}
            dockerLoading={props.dockerLoading}
            dockerError={props.dockerError}
            dockerBadge={props.dockerBadge}
          />
        ) : null}

        <LargeDirectoriesCard
          directories={props.directories}
          diskLoading={props.diskLoading}
          diskError={props.diskError}
        />
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
