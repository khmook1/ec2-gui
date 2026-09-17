import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  ensureRemoteDiskHistory,
  getRemoteDiskHistory,
  getRemoteDiskOverview,
  getRemoteDockerOverview,
  getRemotePermissionOverview,
  getRemoteSystemResources,
  listRemoteSshSessions,
} from "@/services/tauri";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type { DockerOverview } from "@/types/docker";

export function useDiskOverviewQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.diskOverview(sessionKey ?? ""),
    queryFn: getRemoteDiskOverview,
    enabled: Boolean(sessionKey),
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
