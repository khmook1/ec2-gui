import { IconButton } from "@/components/common/IconButton";
import { ActivityPlaceholder } from "@/components/dashboard/ActivityPlaceholder";
import { RefreshIcon, TerminalIcon } from "@/components/icons/ToolbarIcons";
import { SectionCard } from "@/components/dashboard/atoms/SectionCard";
import { DiskCapacitySection } from "@/components/dashboard/DiskCapacitySection";
import { pickPrimaryFilesystem } from "@/components/dashboard/utils/diskUi";
import {
  DockerOverviewSection,
  pickRecentDockerContainers,
  summarizeDockerContainers,
  type DockerOverviewCounts,
} from "@/components/dashboard/DockerOverviewSection";
import { LargeDirectoriesSection } from "@/components/dashboard/LargeDirectoriesSection";
import { PermissionsSection } from "@/components/dashboard/PermissionsSection";
import { SshSessionsSection } from "@/components/dashboard/SshSessionsSection";
import {
  DashboardSummary,
  formatAppLabels,
} from "@/components/dashboard/Summary";
import { SystemResourcesSection } from "@/components/dashboard/SystemResourcesSection";
import {
  useDiskOverviewQuery,
  useDockerContainersQuery,
  useDockerImagesQuery,
  useDockerNetworksQuery,
  useDockerVolumesQuery,
  usePermissionOverviewQuery,
  useSshSessionsQuery,
  useSystemResourcesQuery,
} from "@/hooks/query";
import { useAppInfo } from "@/hooks/useAppInfo";
import {
  diskHistoryHostKey,
  loadDiskUsageHistory,
  pushDiskUsageSample,
  type DiskUsageSample,
} from "@/lib/diskUsageHistory";
import { loadAutoLoginCache } from "@/lib/loginCache";
import { useTerminalStore } from "@/stores/terminalStore";
import type { RemotePermissionOverview } from "@/types/permissions";
import { formatFileSize } from "@/utils/file";
import { useEffect, useMemo, useState } from "react";
import "../components/dashboard/css/dashboard.css";

function errorMessage(error: unknown, fallback: string): string | null {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

function permissionBadge(
  permissions: RemotePermissionOverview | null,
): string | null {
  if (!permissions) {
    return null;
  }
  if (permissions.isRoot || permissions.sudo === "root") {
    return "root";
  }
  if (permissions.sudo === "passwordless") {
    return "sudo";
  }
  if (permissions.sudo === "group") {
    return "제한 sudo";
  }
  return "일반";
}

export function DashboardPage() {
  const { isReady: appReady, appInfo } = useAppInfo();
  const { appName } = formatAppLabels(appInfo?.name, appInfo?.version);

  const setTerminalOpen = useTerminalStore((state) => state.setOpen);

  const hostKey = useMemo(() => {
    const cache = loadAutoLoginCache();
    return diskHistoryHostKey(cache?.host, cache?.port, cache?.username);
  }, []);

  const [diskHistory, setDiskHistory] = useState<DiskUsageSample[]>(() =>
    loadDiskUsageHistory(hostKey),
  );

  const diskQuery = useDiskOverviewQuery();
  const systemQuery = useSystemResourcesQuery();
  const sshQuery = useSshSessionsQuery();
  const permissionQuery = usePermissionOverviewQuery();
  const containersQuery = useDockerContainersQuery();
  const imagesQuery = useDockerImagesQuery();
  const volumesQuery = useDockerVolumesQuery();
  const networksQuery = useDockerNetworksQuery();

  useEffect(() => {
    if (!diskQuery.data) {
      return;
    }
    const primary = pickPrimaryFilesystem(diskQuery.data.filesystems);
    if (primary) {
      setDiskHistory(
        pushDiskUsageSample(hostKey, {
          usePercent: primary.usePercent,
          usedBytes: primary.usedBytes,
          mountedOn: primary.mountedOn,
        }),
      );
    }
  }, [diskQuery.data, hostKey]);

  const diskOverview = diskQuery.data ?? null;
  const systemResources = systemQuery.data ?? null;
  const sshSessions = sshQuery.data ?? [];
  const permissions = permissionQuery.data ?? null;

  const diskError = diskQuery.isError
    ? errorMessage(diskQuery.error, "디스크 정보를 불러오지 못했습니다.")
    : null;
  const systemError = systemQuery.isError
    ? errorMessage(systemQuery.error, "시스템 리소스를 불러오지 못했습니다.")
    : null;
  const sshError = sshQuery.isError
    ? errorMessage(sshQuery.error, "SSH 세션을 불러오지 못했습니다.")
    : null;
  const permissionError = permissionQuery.isError
    ? errorMessage(permissionQuery.error, "권한 정보를 불러오지 못했습니다.")
    : null;

  const dockerFailures = [
    containersQuery.isError
      ? errorMessage(
          containersQuery.error,
          "컨테이너 목록을 불러오지 못했습니다.",
        )
      : null,
    imagesQuery.isError
      ? errorMessage(imagesQuery.error, "이미지 목록을 불러오지 못했습니다.")
      : null,
    volumesQuery.isError
      ? errorMessage(volumesQuery.error, "볼륨 목록을 불러오지 못했습니다.")
      : null,
    networksQuery.isError
      ? errorMessage(
          networksQuery.error,
          "네트워크 목록을 불러오지 못했습니다.",
        )
      : null,
  ].filter((message): message is string => Boolean(message));

  const containers = containersQuery.data ?? [];
  const images = imagesQuery.data ?? [];
  const volumes = volumesQuery.data ?? [];
  const networks = networksQuery.data ?? [];

  const allDockerFailed = dockerFailures.length === 4;
  const dockerCounts: DockerOverviewCounts | null = allDockerFailed
    ? null
    : {
        containers: summarizeDockerContainers(containers),
        images: images.length,
        volumes: volumes.length,
        networks: networks.length,
      };
  const recentContainers = allDockerFailed
    ? []
    : pickRecentDockerContainers(containers);
  const dockerError = allDockerFailed
    ? (dockerFailures[0] ?? "Docker 정보를 불러오지 못했습니다.")
    : dockerFailures.length > 0
      ? dockerFailures.join(" · ")
      : null;

  const loading =
    diskQuery.isPending ||
    systemQuery.isPending ||
    sshQuery.isPending ||
    permissionQuery.isPending ||
    containersQuery.isPending ||
    imagesQuery.isPending ||
    volumesQuery.isPending ||
    networksQuery.isPending;

  const refreshing =
    diskQuery.isFetching ||
    systemQuery.isFetching ||
    sshQuery.isFetching ||
    permissionQuery.isFetching ||
    containersQuery.isFetching ||
    imagesQuery.isFetching ||
    volumesQuery.isFetching ||
    networksQuery.isFetching;

  const refreshAll = () => {
    void diskQuery.refetch();
    void systemQuery.refetch();
    void sshQuery.refetch();
    void permissionQuery.refetch();
    void containersQuery.refetch();
    void imagesQuery.refetch();
    void volumesQuery.refetch();
    void networksQuery.refetch();
  };

  const filesystems = diskOverview?.filesystems ?? [];
  const directories = diskOverview?.largeDirectories ?? [];
  const primary = pickPrimaryFilesystem(filesystems);
  const storageBadge =
    !loading && !diskError && primary
      ? formatFileSize(primary.sizeBytes)
      : null;
  const dockerBadge =
    !loading && dockerCounts
      ? `${dockerCounts.containers.running} / ${dockerCounts.containers.total}`
      : null;
  const permissionsBadge =
    !loading && !permissionError ? permissionBadge(permissions) : "준비 중";

  return (
    <section className="explorer dashboard-page">
      <div className="dashboard-page__content">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar__copy">
            <p className="dashboard-topbar__eyebrow">인프라 개요</p>
            <h1 className="dashboard-topbar__title">
              {appReady
                ? `${appName} · 서버 상태 정상`
                : `${appName} · 호스트 확인 중…`}
            </h1>
          </div>
          <div className="dashboard-topbar__actions">
            <IconButton
              tone="success"
              tooltip="새로고침"
              aria-label="새로고침"
              disabled={refreshing}
              onClick={() => void refreshAll()}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              tone="accent"
              tooltip="터미널 열기"
              aria-label="터미널 열기"
              onClick={() => setTerminalOpen(true)}
            >
              <TerminalIcon />
            </IconButton>
          </div>
        </header>

        <DashboardSummary
          appReady={appReady}
          filesystems={filesystems}
          dockerCounts={dockerCounts}
          sshSessionCount={sshSessions.length}
          loading={loading}
        />

        <div className="dashboard-grid">
          <div className="dashboard-grid__left">
            <SectionCard
              title="시스템 리소스"
              subtitle="실시간"
              badge={systemResources && !systemError ? "0.3s 샘플" : "준비 중"}
            >
              <SystemResourcesSection
                resources={systemResources}
                loading={systemQuery.isPending}
                error={systemError}
              />
            </SectionCard>

            <SectionCard
              title="Docker 컨테이너"
              subtitle="최근 활동"
              badge={dockerBadge}
            >
              <DockerOverviewSection
                counts={dockerCounts}
                recentContainers={recentContainers}
                loading={
                  containersQuery.isPending ||
                  imagesQuery.isPending ||
                  volumesQuery.isPending ||
                  networksQuery.isPending
                }
                error={dockerError}
              />
            </SectionCard>

            <SectionCard
              title="용량이 큰 디렉터리"
              subtitle="루트 1depth"
              badge={
                !diskQuery.isPending && !diskError && directories.length > 0
                  ? directories.length
                  : null
              }
            >
              <LargeDirectoriesSection
                directories={directories}
                loading={diskQuery.isPending}
                error={diskError}
              />
            </SectionCard>
          </div>

          <div className="dashboard-grid__right">
            <SectionCard
              title="내 권한"
              subtitle="접속 계정"
              badge={permissionsBadge}
            >
              <PermissionsSection
                permissions={permissions}
                loading={permissionQuery.isPending}
                error={permissionError}
              />
            </SectionCard>

            <SectionCard
              title="스토리지"
              subtitle="마운트 포인트"
              badge={storageBadge}
            >
              <DiskCapacitySection
                filesystems={filesystems}
                history={diskHistory}
                loading={diskQuery.isPending}
                error={diskError}
              />
            </SectionCard>

            <SectionCard
              title="SSH 세션"
              subtitle="원격 로그인"
              badge={
                !sshQuery.isPending && !sshError
                  ? `${sshSessions.length}개 활성`
                  : "준비 중"
              }
            >
              <SshSessionsSection
                sessions={sshSessions}
                loading={sshQuery.isPending}
                error={sshError}
              />
            </SectionCard>

            <SectionCard title="최근 활동" badge="최신">
              <ActivityPlaceholder />
            </SectionCard>
          </div>
        </div>
      </div>
    </section>
  );
}
