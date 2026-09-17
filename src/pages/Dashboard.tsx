import { IconButton } from "@/components/common/IconButton";
import { ActivityPlaceholder } from "@/components/dashboard/ActivityPlaceholder";
import { FeatureComingSoon } from "@/components/dashboard/FeatureComingSoon";
import { RefreshIcon, TerminalIcon } from "@/components/icons/ToolbarIcons";
import { SectionCard } from "@/components/dashboard/atoms/SectionCard";
import { DiskCapacitySection } from "@/components/dashboard/DiskCapacitySection";
import { pickPrimaryFilesystem } from "@/components/dashboard/utils/diskUi";
import { dashboardFeatureSupport } from "@/components/dashboard/utils/featureSupport";
import {
  DockerOverviewSection,
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

  const showLeftSystem = features.systemResources;
  const showLeftDocker = showDocker;
  const showLeftDirs = features.largeDirectories;
  const leftHasSections = showLeftSystem || showLeftDocker || showLeftDirs;
  const leftColumnReady =
    Boolean(diskQuery.data) && !dockerInstalledQuery.isPending;
  const showLeftComingSoon = leftColumnReady && !leftHasSections;

  const showRightPermissions = true;
  const showRightStorage = true;
  const showRightSsh = true;
  const showRightActivity = features.activity;
  const rightHasSections =
    showRightPermissions ||
    showRightStorage ||
    showRightSsh ||
    showRightActivity;
  const showRightComingSoon = !rightHasSections;

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

        <div className="dashboard-grid">
          <div className="dashboard-grid__left">
            {showLeftComingSoon ? (
              <SectionCard title="기능 준비 중" badge="준비 중">
                <FeatureComingSoon label="왼쪽 패널 준비 중" />
              </SectionCard>
            ) : null}

            {showLeftSystem ? (
              <SectionCard
                title="시스템 리소스"
                subtitle="실시간"
                badge={
                  systemResources && !systemError ? "0.3s 샘플" : "준비 중"
                }
              >
                <SystemResourcesSection
                  resources={systemResources}
                  loading={systemQuery.isPending}
                  error={systemError}
                />
              </SectionCard>
            ) : null}

            {showLeftDocker ? (
              <SectionCard
                title="Docker 컨테이너"
                subtitle="최근 활동"
                badge={dockerBadge}
              >
                <DockerOverviewSection
                  counts={dockerCounts}
                  recentContainers={recentContainers}
                  loading={dockerQuery.isPending}
                  error={dockerError}
                />
              </SectionCard>
            ) : null}

            {showLeftDirs ? (
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
            ) : null}
          </div>

          <div className="dashboard-grid__right">
            {showRightComingSoon ? (
              <SectionCard title="기능 준비 중" badge="준비 중">
                <FeatureComingSoon label="오른쪽 패널 준비 중" />
              </SectionCard>
            ) : null}

            {showRightPermissions ? (
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
            ) : null}

            {showRightStorage ? (
              <SectionCard
                title="스토리지"
                subtitle="마운트 포인트"
                badge={storageBadge}
              >
                <DiskCapacitySection
                  filesystems={filesystems}
                  history={diskHistory}
                  loading={diskQuery.isPending || diskHistoryQuery.isPending}
                  error={diskError}
                />
              </SectionCard>
            ) : null}

            {showRightSsh ? (
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
            ) : null}

            {showRightActivity ? (
              <SectionCard title="최근 활동" badge="최신">
                <ActivityPlaceholder />
              </SectionCard>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
