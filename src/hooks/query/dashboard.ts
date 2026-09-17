import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  getRemoteDiskOverview,
  getRemotePermissionOverview,
  getRemoteSystemResources,
  listRemoteSshSessions,
} from "@/services/tauri";

export function useDiskOverviewQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.diskOverview(sessionKey ?? ""),
    queryFn: getRemoteDiskOverview,
    enabled: Boolean(sessionKey),
  });
}

export function useSystemResourcesQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.systemResources(sessionKey ?? ""),
    queryFn: getRemoteSystemResources,
    enabled: Boolean(sessionKey),
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
