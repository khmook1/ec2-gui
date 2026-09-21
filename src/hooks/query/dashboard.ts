import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  ensureRemoteDiskHistory,
  getRemoteDiskHistory,
  getRemoteDiskOverview,
  getRemoteDockerOverview,
  getRemoteLargeDirectories,
  getRemotePermissionOverview,
  getRemoteSystemResources,
  listRemoteSshSessions,
} from "@/services/tauri";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type { DockerOverview } from "@/types/docker";
import type { LargeDirectory } from "@/types/disk";

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
        // crontab/python 미설치여도 기존 storage.json은 읽기 시도
      }
      return getRemoteDiskHistory();
    },
    enabled: Boolean(sessionKey),
  });
}

export function useSystemResourcesQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.systemResources(sessionKey ?? ""),
    queryFn: getRemoteSystemResources,
    enabled,
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

export function usePermissionOverviewQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.permissions(sessionKey ?? ""),
    queryFn: getRemotePermissionOverview,
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
