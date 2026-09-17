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
  diskHistoryHostKey,
  loadDiskUsageHistory,
  pushDiskUsageSample,
  type DiskUsageSample,
} from "@/lib/diskUsageHistory";
import { loadAutoLoginCache } from "@/lib/loginCache";
import {
  getRemoteDiskOverview,
  getRemotePermissionOverview,
  getRemoteSystemResources,
  listRemoteDockerContainers,
  listRemoteDockerImages,
  listRemoteDockerNetworks,
  listRemoteDockerVolumes,
  listRemoteSshSessions,
} from "@/services/tauri";
import { useAppStore } from "@/stores/appStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type { DiskOverview } from "@/types/disk";
import type { DockerContainer } from "@/types/docker";
import type { RemotePermissionOverview } from "@/types/permissions";
import type { RemoteSshSession } from "@/types/sshSession";
import type { SystemResources } from "@/types/system";
import { formatFileSize } from "@/utils/file";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../components/dashboard/css/dashboard.css";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

function collectRejectedMessages(
  results: Array<{ result: PromiseSettledResult<unknown>; fallback: string }>,
): string[] {
  return results.flatMap(({ result, fallback }) =>
    result.status === "rejected" ? [errorMessage(result.reason, fallback)] : [],
  );
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
  const status = useAppStore((state) => state.status);
  const appInfo = useAppStore((state) => state.appInfo);
  const appReady = status === "ready";
  const { appName } = formatAppLabels(appInfo?.name, appInfo?.version);

  const setTerminalOpen = useTerminalStore((state) => state.setOpen);

  const hostKey = useMemo(() => {
    const cache = loadAutoLoginCache();
    return diskHistoryHostKey(cache?.host, cache?.port, cache?.username);
  }, []);

  const [diskOverview, setDiskOverview] = useState<DiskOverview | null>(null);
  const [diskHistory, setDiskHistory] = useState<DiskUsageSample[]>(() =>
    loadDiskUsageHistory(hostKey),
  );
  const [systemResources, setSystemResources] =
    useState<SystemResources | null>(null);
  const [sshSessions, setSshSessions] = useState<RemoteSshSession[]>([]);
  const [permissions, setPermissions] =
    useState<RemotePermissionOverview | null>(null);
  const [dockerCounts, setDockerCounts] = useState<DockerOverviewCounts | null>(
    null,
  );
  const [recentContainers, setRecentContainers] = useState<DockerContainer[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [diskError, setDiskError] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [sshError, setSshError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [dockerError, setDockerError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setDiskError(null);
    setSystemError(null);
    setSshError(null);
    setPermissionError(null);
    setDockerError(null);

    const [
      diskResult,
      systemResult,
      sshResult,
      permissionResult,
      containersResult,
      imagesResult,
      volumesResult,
      networksResult,
    ] = await Promise.allSettled([
      getRemoteDiskOverview(),
      getRemoteSystemResources(),
      listRemoteSshSessions(),
      getRemotePermissionOverview(),
      listRemoteDockerContainers(),
      listRemoteDockerImages(),
      listRemoteDockerVolumes(),
      listRemoteDockerNetworks(),
    ]);

    if (diskResult.status === "fulfilled") {
      setDiskOverview(diskResult.value);
      const primary = pickPrimaryFilesystem(diskResult.value.filesystems);
      if (primary) {
        setDiskHistory(
          pushDiskUsageSample(hostKey, {
            usePercent: primary.usePercent,
            usedBytes: primary.usedBytes,
            mountedOn: primary.mountedOn,
          }),
        );
      }
    } else {
      setDiskOverview(null);
      setDiskError(
        errorMessage(diskResult.reason, "디스크 정보를 불러오지 못했습니다."),
      );
    }

    if (systemResult.status === "fulfilled") {
      setSystemResources(systemResult.value);
    } else {
      setSystemResources(null);
      setSystemError(
        errorMessage(
          systemResult.reason,
          "시스템 리소스를 불러오지 못했습니다.",
        ),
      );
    }

    if (sshResult.status === "fulfilled") {
      setSshSessions(sshResult.value);
    } else {
      setSshSessions([]);
      setSshError(
        errorMessage(sshResult.reason, "SSH 세션을 불러오지 못했습니다."),
      );
    }

    if (permissionResult.status === "fulfilled") {
      setPermissions(permissionResult.value);
    } else {
      setPermissions(null);
      setPermissionError(
        errorMessage(
          permissionResult.reason,
          "권한 정보를 불러오지 못했습니다.",
        ),
      );
    }

    const dockerFailures = collectRejectedMessages([
      {
        result: containersResult,
        fallback: "컨테이너 목록을 불러오지 못했습니다.",
      },
      { result: imagesResult, fallback: "이미지 목록을 불러오지 못했습니다." },
      { result: volumesResult, fallback: "볼륨 목록을 불러오지 못했습니다." },
      {
        result: networksResult,
        fallback: "네트워크 목록을 불러오지 못했습니다.",
      },
    ]);

    const containers =
      containersResult.status === "fulfilled" ? containersResult.value : [];
    const images =
      imagesResult.status === "fulfilled" ? imagesResult.value : [];
    const volumes =
      volumesResult.status === "fulfilled" ? volumesResult.value : [];
    const networks =
      networksResult.status === "fulfilled" ? networksResult.value : [];

    if (dockerFailures.length === 4) {
      setDockerCounts(null);
      setRecentContainers([]);
      setDockerError(dockerFailures[0] ?? "Docker 정보를 불러오지 못했습니다.");
    } else {
      setDockerCounts({
        containers: summarizeDockerContainers(containers),
        images: images.length,
        volumes: volumes.length,
        networks: networks.length,
      });
      setRecentContainers(pickRecentDockerContainers(containers));
      setDockerError(
        dockerFailures.length > 0 ? dockerFailures.join(" · ") : null,
      );
    }

    setLoading(false);
  }, [hostKey]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
              disabled={loading}
              onClick={() => void loadDashboard()}
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
                loading={loading}
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
                loading={loading}
                error={dockerError}
              />
            </SectionCard>

            <SectionCard
              title="용량이 큰 디렉터리"
              subtitle="루트 1depth"
              badge={
                !loading && !diskError && directories.length > 0
                  ? directories.length
                  : null
              }
            >
              <LargeDirectoriesSection
                directories={directories}
                loading={loading}
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
                loading={loading}
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
                loading={loading}
                error={diskError}
              />
            </SectionCard>

            <SectionCard
              title="SSH 세션"
              subtitle="원격 로그인"
              badge={
                !loading && !sshError
                  ? `${sshSessions.length}개 활성`
                  : "준비 중"
              }
            >
              <SshSessionsSection
                sessions={sshSessions}
                loading={loading}
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
