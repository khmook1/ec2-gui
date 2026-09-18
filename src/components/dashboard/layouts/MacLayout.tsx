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
 * macOS 원격 호스트용 대시보드.
 * 시스템 리소스·제한 경로 대용량 디렉터리·Data 볼륨 중심 스토리지를 포함합니다.
 */
export function MacLayout({ showDocker, ...props }: DashboardLayoutProps) {
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
          subtitle="Users · Apps · Library"
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
