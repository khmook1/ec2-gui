import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  checkRemoteDocker,
  getRemoteDockerContainerDetails,
  getRemoteDockerContainerLogs,
  listRemoteDockerContainers,
  listRemoteDockerImages,
  listRemoteDockerNetworks,
  listRemoteDockerVolumes,
  runRemoteDockerImageAction,
  runRemoteDockerNetworkAction,
  runRemoteDockerSystemAction,
  runRemoteDockerVolumeAction,
} from "@/services/tauri";
import type { DockerSystemAction } from "@/types/docker";

export function useDockerInstalledQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerInstalled(sessionKey ?? ""),
    queryFn: checkRemoteDocker,
    enabled: Boolean(sessionKey),
  });
}

export function useDockerContainersQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.dockerContainers(sessionKey ?? ""),
    queryFn: listRemoteDockerContainers,
    enabled,
  });
}

export function useDockerImagesQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerImages(sessionKey ?? ""),
    queryFn: listRemoteDockerImages,
    enabled: Boolean(sessionKey),
  });
}

export function useDockerVolumesQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerVolumes(sessionKey ?? ""),
    queryFn: listRemoteDockerVolumes,
    enabled: Boolean(sessionKey),
  });
}

export function useDockerNetworksQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerNetworks(sessionKey ?? ""),
    queryFn: listRemoteDockerNetworks,
    enabled: Boolean(sessionKey),
  });
}

export function useDockerContainerDetailsQuery(containerId: string | null) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerContainerDetails(
      sessionKey ?? "",
      containerId ?? "",
    ),
    queryFn: () => getRemoteDockerContainerDetails(containerId!),
    enabled: Boolean(sessionKey && containerId),
  });
}

export function useDockerImageInspectQuery(imageRef: string | null) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerImageInspect(sessionKey ?? "", imageRef ?? ""),
    queryFn: () => runRemoteDockerImageAction(imageRef!, "inspect"),
    enabled: Boolean(sessionKey && imageRef),
  });
}

export function useDockerImageHistoryQuery(
  imageRef: string | null,
  options?: { enabled?: boolean },
) {
  const sessionKey = useSessionKey();
  const enabled =
    Boolean(sessionKey && imageRef) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.dockerImageHistory(sessionKey ?? "", imageRef ?? ""),
    queryFn: () => runRemoteDockerImageAction(imageRef!, "history"),
    enabled,
  });
}

export function useDockerVolumeInspectQuery(volumeName: string | null) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerVolumeInspect(
      sessionKey ?? "",
      volumeName ?? "",
    ),
    queryFn: () => runRemoteDockerVolumeAction(volumeName!, "inspect"),
    enabled: Boolean(sessionKey && volumeName),
  });
}

export function useDockerNetworkInspectQuery(networkRef: string | null) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerNetworkInspect(
      sessionKey ?? "",
      networkRef ?? "",
    ),
    queryFn: () => runRemoteDockerNetworkAction(networkRef!, "inspect"),
    enabled: Boolean(sessionKey && networkRef),
  });
}

export function useDockerSystemOutputQuery(
  action: Extract<DockerSystemAction, "df" | "info"> | null,
) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dockerSystemOutput(sessionKey ?? "", action ?? ""),
    queryFn: () => runRemoteDockerSystemAction(action!),
    enabled: Boolean(sessionKey && action),
  });
}

export function useDockerContainerLogsQuery(
  containerId: string | null,
  options: { tail: number; since: string; enabled?: boolean },
) {
  const sessionKey = useSessionKey();
  const enabled =
    Boolean(sessionKey && containerId) && (options.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.dockerContainerLogs(
      sessionKey ?? "",
      containerId ?? "",
      options.tail,
      options.since,
    ),
    queryFn: () =>
      getRemoteDockerContainerLogs(containerId!, {
        tail: options.tail,
        since: options.since || undefined,
      }),
    enabled,
  });
}

export function usePrefetchDockerContainers() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useCallback(() => {
    if (!sessionKey) {
      return;
    }
    void queryClient.prefetchQuery({
      queryKey: queryKeys.dockerContainers(sessionKey),
      queryFn: listRemoteDockerContainers,
    });
  }, [queryClient, sessionKey]);
}
