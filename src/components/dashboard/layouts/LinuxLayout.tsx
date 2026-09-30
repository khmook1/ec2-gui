import {
  BlockDevicesCard,
  DockerOverviewCard,
  LargeDirectoriesCard,
  ResourceOverviewCard,
  SshSessionsCard,
} from "./SectionCards";
import { DashboardArea } from "@/components/dashboard/atoms/DashboardArea";
import { DockerSectionIcon } from "@/components/icons/DashboardSectionIcons";
import type { DashboardLayoutProps } from "./types";

/**
 * Linux 원격 호스트용 대시보드.
 * 호스트 리소스·스토리지 추이를 상단에 모으고, Docker 영역을 분리해 관리합니다.
 */
export function LinuxLayout({
  showDocker,
  ...props
}: DashboardLayoutProps) {
  return (
    <>
      <ResourceOverviewCard
        systemResources={props.systemResources}
        systemLoading={props.systemLoading}
        systemError={props.systemError}
        filesystems={props.filesystems}
        diskLoading={props.diskLoading}
        diskError={props.diskError}
        storageBadge={props.storageBadge}
        os={props.os}
      />

      <div className="dashboard-grid">
        <div className="dashboard-grid__left">
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
    </>
  );
}
