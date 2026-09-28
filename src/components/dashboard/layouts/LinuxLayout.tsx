import {
  BlockDevicesCard,
  DockerOverviewCard,
  LargeDirectoriesCard,
  PermissionsCard,
  SshSessionsCard,
  StorageCard,
  SystemResourcesCard,
} from "./SectionCards";
import { DashboardArea } from "@/components/dashboard/atoms/DashboardArea";
import { DockerSectionIcon } from "@/components/icons/DashboardSectionIcons";
import type { DashboardLayoutProps } from "./types";

/**
 * Linux 원격 호스트용 대시보드.
 * 호스트 리소스·스토리지와 Docker 영역을 분리해 관리합니다.
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

        <LargeDirectoriesCard
          directories={props.directories}
          directoriesLoading={props.directoriesLoading}
          directoriesError={props.directoriesError}
        />

        {showDocker ? (
          <DashboardArea
            title="Docker"
            subtitle="컨테이너 · 이미지 · 볼륨"
            icon={<DockerSectionIcon />}
            className="dashboard-area--docker"
          >
            <DockerOverviewCard
              dockerCounts={props.dockerCounts}
              recentContainers={props.recentContainers}
              dockerLoading={props.dockerLoading}
              dockerError={props.dockerError}
              dockerBadge={props.dockerBadge}
            />
          </DashboardArea>
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
        <BlockDevicesCard
          blockDevices={props.blockDevices}
          blockDevicesLoading={props.blockDevicesLoading}
          blockDevicesError={props.blockDevicesError}
          onExpandDisk={props.onExpandDisk}
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
