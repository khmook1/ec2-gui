import { IconButton } from "@/components/common/IconButton";
import { RefreshIcon, TerminalIcon } from "@/components/icons/ToolbarIcons";
import { pickPrimaryFilesystem } from "@/components/dashboard/utils/diskUi";
import { dashboardFeatureSupport } from "@/components/dashboard/utils/featureSupport";
import {
  DashboardSummary,
  formatAppLabels,
} from "@/components/dashboard/Summary";
import {
  DashboardOsLayout,
  type DashboardLayoutProps,
} from "@/components/dashboard/layouts";
import type { DockerOverviewCounts } from "@/components/dashboard/DockerOverviewSection";
import {
  useDiskHistoryQuery,
  useDiskOverviewQuery,
  useDockerInstalledQuery,
  useDockerOverviewQuery,
  usePermissionOverviewQuery,
  useSshSessionsQuery,
  useSystemResourcesQuery,
} from "@/hooks/query";
import { useAppInfo } from "@/hooks/useAppInfo";
import { collapseToHourly } from "@/lib/diskUsageHistory";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type { RemotePermissionOverview } from "@/types/permissions";
import { formatFileSize } from "@/utils/file";
import { useMemo } from "react";
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
  const showServerSyncOverlay = useConnectionStore(
    (state) => state.showServerSyncOverlay,
  );

  const diskQuery = useDiskOverviewQuery();
  const diskHistoryQuery = useDiskHistoryQuery();
  const features = dashboardFeatureSupport(diskQuery.data?.os);
  const systemQuery = useSystemResourcesQuery({
    enabled: features.systemResources,
  });
  const sshQuery = useSshSessionsQuery();
  const permissionQuery = usePermissionOverviewQuery();
  const dockerInstalledQuery = useDockerInstalledQuery();
  const showDocker = dockerInstalledQuery.data === true;
  const dockerQuery = useDockerOverviewQuery({ enabled: showDocker });

  const diskHistory = useMemo(
    () => collapseToHourly(diskHistoryQuery.data ?? []),
    [diskHistoryQuery.data],
  );

  const diskOverview = diskQuery.data ?? null;
  const systemResources = systemQuery.data ?? null;
  const sshSessions = sshQuery.data ?? [];
  const permissions = permissionQuery.data ?? null;
  const dockerOverview = dockerQuery.data ?? null;

  const diskError = diskQuery.isError
    ? errorMessage(diskQuery.error, "디스크 정보를 불러오지 못했습니다.")
    : null;
  const systemError =
    features.systemResources && systemQuery.isError
      ? errorMessage(systemQuery.error, "시스템 리소스를 불러오지 못했습니다.")
      : null;
  const sshError = sshQuery.isError
    ? errorMessage(sshQuery.error, "SSH 세션을 불러오지 못했습니다.")
    : null;
  const permissionError = permissionQuery.isError
    ? errorMessage(permissionQuery.error, "권한 정보를 불러오지 못했습니다.")
    : null;

  const dockerCounts: DockerOverviewCounts | null = dockerOverview
    ? {
        containers: dockerOverview.containers,
        images: dockerOverview.images,
        volumes: dockerOverview.volumes,
        networks: dockerOverview.networks,
      }
    : null;
  const recentContainers = dockerOverview?.recentContainers ?? [];
  const dockerError = dockerQuery.isError
    ? errorMessage(dockerQuery.error, "Docker 정보를 불러오지 못했습니다.")
    : dockerOverview && dockerOverview.warnings.length > 0
      ? dockerOverview.warnings.join(" · ")
      : null;

  const loading =
    diskQuery.isPending ||
    diskHistoryQuery.isPending ||
    (features.systemResources && systemQuery.isPending) ||
    sshQuery.isPending ||
    permissionQuery.isPending ||
    (showDocker && dockerQuery.isPending);

  const refreshing =
    diskQuery.isFetching ||
    diskHistoryQuery.isFetching ||
    (features.systemResources && systemQuery.isFetching) ||
    sshQuery.isFetching ||
    permissionQuery.isFetching ||
    (showDocker && dockerQuery.isFetching);

  const refreshAll = () => {
    void diskQuery.refetch();
    void diskHistoryQuery.refetch();
    if (features.systemResources) {
      void systemQuery.refetch();
    }
    void sshQuery.refetch();
    void permissionQuery.refetch();
    if (showDocker) {
      void dockerQuery.refetch();
    }
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

  const layoutProps: DashboardLayoutProps = {
    loading,
    filesystems,
    directories,
    diskHistory,
    diskLoading: diskQuery.isPending,
    diskHistoryLoading: diskHistoryQuery.isPending,
    diskError,
    storageBadge,
    systemResources,
    systemLoading: systemQuery.isPending,
    systemError,
    showDocker,
    dockerCounts,
    recentContainers,
    dockerLoading: dockerQuery.isPending,
    dockerError,
    dockerBadge,
    dockerInstalledPending: dockerInstalledQuery.isPending,
    sshSessions,
    sshLoading: sshQuery.isPending,
    sshError,
    permissions,
    permissionsLoading: permissionQuery.isPending,
    permissionError,
    permissionsBadge,
  };

  return (
    <section className="explorer dashboard-page">
      <div className="dashboard-page__content">
        {loading && !showServerSyncOverlay ? (
          <p className="dashboard-connect-hint" role="status">
            연결 시 서버 정보를 불러오는 데 최대 5분 정도 걸릴 수 있습니다.
          </p>
        ) : null}

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
          showDocker={showDocker}
        />

        <DashboardOsLayout os={diskOverview?.os} {...layoutProps} />
      </div>
    </section>
  );
}
