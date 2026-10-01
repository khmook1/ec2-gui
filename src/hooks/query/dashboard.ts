import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  expandRemoteDisk,
  getRemoteBlockDevices,
  getRemoteDiskExpandStatus,
  getRemoteDiskHistory,
  getRemoteDiskOverview,
  getRemoteDockerOverview,
  getRemoteLargeDirectories,
  getRemoteResourceHistory,
  getRemoteSystemResources,
  listRemoteResourceHistoryDays,
  listRemoteSshSessions,
} from "@/services/tauri";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type { DockerOverview } from "@/types/docker";
import type {
  ResourceHistoryDays,
  ResourceHistorySample,
} from "@/types/system";
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

/** `du`는 루트 전체를 순회해 원격 CPU·I/O를 크게 쓰므로 한 번 받은 결과를 이 시간 동안 재사용한다. */
export const LARGE_DIRECTORIES_FRESH_MS = 60 * 60 * 1000;

/** `du` 스캔은 SSH 세션을 오래 점유하므로 초기 동기화·파일 목록 이후에 실행한다. */
export function useLargeDirectoriesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<LargeDirectory[]>({
    queryKey: queryKeys.largeDirectories(sessionKey ?? ""),
    queryFn: getRemoteLargeDirectories,
    enabled,
    staleTime: LARGE_DIRECTORIES_FRESH_MS,
    gcTime: LARGE_DIRECTORIES_FRESH_MS,
  });
}

/** 앱이 이 컴퓨터에 저장한 일별 디스크 샘플. 오늘 샘플은 디스크 개요 조회 때 백엔드가 기록한다. */
export function useDiskHistoryQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.diskHistory(sessionKey ?? ""),
    queryFn: (): Promise<DiskUsageSample[]> => getRemoteDiskHistory(),
    enabled,
  });
}

export function useBlockDevicesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<BlockDevice[]>({
    queryKey: queryKeys.blockDevices(sessionKey ?? ""),
    queryFn: getRemoteBlockDevices,
    enabled,
    staleTime: 10 * 60 * 1000,
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

/**
 * 현재 사용률 칩 갱신 간격. 조회마다 원격 프로세스를 띄우므로 서버 부하를 위해 짧게 줄이지 않는다.
 * 대시보드가 보일 때만 폴링한다.
 */
export const SYSTEM_RESOURCES_POLL_MS = 5000;

/** 앱 백엔드 수집 간격(10초)과 맞춘 추이 차트 증분 조회 간격 */
export const RESOURCE_HISTORY_POLL_MS = 10_000;

export function useSystemResourcesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.systemResources(sessionKey ?? ""),
    queryFn: getRemoteSystemResources,
    enabled,
    refetchInterval: SYSTEM_RESOURCES_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useResourceHistoryDaysQuery() {
  const sessionKey = useSessionKey();

  return useQuery<ResourceHistoryDays>({
    queryKey: queryKeys.resourceHistoryDays(sessionKey ?? ""),
    queryFn: listRemoteResourceHistoryDays,
    enabled: Boolean(sessionKey),
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
  });
}

/**
 * 선택한 날짜의 저장 샘플. `live`(오늘)이면 주기적으로 마지막 샘플 이후만 받아 이어 붙인다.
 * 쿼리 캐시에 남으므로 화면을 옮겼다 돌아와도 다시 모으지 않는다.
 */
export function useResourceHistoryQuery(
  date: string | null,
  options: { live: boolean },
) {
  const sessionKey = useSessionKey();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.resourceHistory(sessionKey ?? "", date ?? "");

  return useQuery<ResourceHistorySample[]>({
    queryKey,
    queryFn: async () => {
      const prev = queryClient.getQueryData<ResourceHistorySample[]>(queryKey);
      const lastTs = prev?.[prev.length - 1]?.ts;
      if (!prev || lastTs == null) {
        return getRemoteResourceHistory(date ?? "");
      }
      const next = await getRemoteResourceHistory(date ?? "", lastTs);
      return next.length > 0 ? [...prev, ...next] : prev;
    },
    enabled: Boolean(sessionKey && date),
    staleTime: options.live ? 0 : Infinity,
    refetchInterval: options.live ? RESOURCE_HISTORY_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export function useSshSessionsQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.sshSessions(sessionKey ?? ""),
    queryFn: listRemoteSshSessions,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useDockerOverviewQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery<DockerOverview>({
    queryKey: queryKeys.dockerOverview(sessionKey ?? ""),
    queryFn: getRemoteDockerOverview,
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
