import {
  DockerOverviewCard,
  LargeDirectoriesCard,
  ResourceOverviewCard,
  SshSessionsCard,
} from "./SectionCards";
import { DashboardArea } from "@/components/dashboard/atoms/DashboardArea";
import { DockerSectionIcon } from "@/components/icons/DashboardSectionIcons";
import type { DashboardLayoutProps } from "./types";

/**
 * macOS 원격 호스트용 대시보드.
 * 시스템 리소스·Data 볼륨 추이를 상단에 모으고, 제한 경로 대용량 디렉터리를 포함합니다.
 */
export function MacLayout({ showDocker, ...props }: DashboardLayoutProps) {
  return (
    <>
      <ResourceOverviewCard
        systemResources={props.systemResources}
        systemUpdatedAt={props.systemUpdatedAt}
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
            subtitle="Users · Apps · Library"
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
