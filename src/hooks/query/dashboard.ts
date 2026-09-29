import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  ensureRemoteDiskHistory,
  expandRemoteDisk,
  getRemoteBlockDevices,
  getRemoteDiskExpandStatus,
  getRemoteDiskHistory,
  getRemoteDiskOverview,
  getRemoteDockerOverview,
  getRemoteLargeDirectories,
  getRemoteSystemResources,
  listRemoteSshSessions,
} from "@/services/tauri";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type { DockerOverview } from "@/types/docker";
import type {
  BlockDevice,
  DiskExpandResult,
  DiskExpandStatus,
  LargeDirectory,
} from "@/types/disk";

export function useDiskOverviewQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.diskOverview(sessionKey ?? ""),
    queryFn: getRemoteDiskOverview,
    enabled: Boolean(sessionKey),
  });
}

/** `du` 스캔은 SSH 세션을 오래 점유하므로 초기 동기화·파일 목록 이후에 실행한다. */
export function useLargeDirectoriesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<LargeDirectory[]>({
    queryKey: queryKeys.largeDirectories(sessionKey ?? ""),
    queryFn: getRemoteLargeDirectories,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDiskHistoryQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.diskHistory(sessionKey ?? ""),
    queryFn: async (): Promise<DiskUsageSample[]> => {
      try {
        await ensureRemoteDiskHistory();
      } catch {
        // crontab/python 미설치여도 기존 일별 파일은 읽기 시도
      }
      return getRemoteDiskHistory();
    },
    enabled: Boolean(sessionKey),
  });
}

export function useBlockDevicesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<BlockDevice[]>({
    queryKey: queryKeys.blockDevices(sessionKey ?? ""),
    queryFn: getRemoteBlockDevices,
    enabled,
  });
}

export function useDiskExpandStatusQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<DiskExpandStatus>({
    queryKey: queryKeys.diskExpandStatus(sessionKey ?? ""),
    queryFn: getRemoteDiskExpandStatus,
    enabled,
  });
}

export function useExpandDiskMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: (targetSizeGb?: number | null) =>
      expandRemoteDisk(targetSizeGb),
    onSuccess: async (result: DiskExpandResult) => {
      if (!sessionKey || !result.success) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.diskOverview(sessionKey),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.diskHistory(sessionKey),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.blockDevices(sessionKey),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.diskExpandStatus(sessionKey),
        }),
      ]);
    },
  });
}

/** 리소스 추이 차트 샘플 수집 간격 (SSH mutex를 점유하므로 너무 짧게 두지 않는다) */
export const SYSTEM_RESOURCES_POLL_MS = 10_000;

/** 첫 로딩 직후 차트를 바로 그릴 수 있도록 짧은 간격으로 모으는 샘플 수 */
const SYSTEM_RESOURCES_WARMUP_SAMPLES = 3;
const SYSTEM_RESOURCES_WARMUP_MS = 2000;

export function useSystemResourcesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.systemResources(sessionKey ?? ""),
    queryFn: getRemoteSystemResources,
    enabled,
    refetchInterval: (query) =>
      query.state.dataUpdateCount < SYSTEM_RESOURCES_WARMUP_SAMPLES
        ? SYSTEM_RESOURCES_WARMUP_MS
        : SYSTEM_RESOURCES_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useSshSessionsQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.sshSessions(sessionKey ?? ""),
    queryFn: listRemoteSshSessions,
    enabled: Boolean(sessionKey),
  });
}

export function useDockerOverviewQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<DockerOverview>({
    queryKey: queryKeys.dockerOverview(sessionKey ?? ""),
    queryFn: getRemoteDockerOverview,
    enabled,
  });
}
