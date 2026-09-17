import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  runRemoteDockerContainerAction,
  runRemoteDockerImageAction,
  runRemoteDockerNetworkAction,
  runRemoteDockerSystemAction,
  runRemoteDockerVolumeAction,
} from "@/services/tauri";
import type {
  DockerContainerAction,
  DockerImageAction,
  DockerNetworkAction,
  DockerSystemAction,
  DockerVolumeAction,
} from "@/types/docker";

function useInvalidateDockerLists() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return async () => {
    if (!sessionKey) {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.dockerContainers(sessionKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dockerImages(sessionKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dockerVolumes(sessionKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dockerNetworks(sessionKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.dockerOverview(sessionKey),
      }),
    ]);
  };
}

export function useDockerContainerActionMutation() {
  const invalidateLists = useInvalidateDockerLists();
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: ({
      containerId,
      action,
    }: {
      containerId: string;
      action: DockerContainerAction;
    }) => runRemoteDockerContainerAction(containerId, action),
    onSuccess: async (_data, variables) => {
      await invalidateLists();
      if (sessionKey) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.dockerContainerDetails(
            sessionKey,
            variables.containerId,
          ),
        });
      }
    },
  });
}

export function useDockerImageActionMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: ({
      imageRef,
      action,
    }: {
      imageRef: string;
      action: DockerImageAction;
    }) => runRemoteDockerImageAction(imageRef, action),
    onSuccess: async (_data, variables) => {
      if (variables.action === "inspect" || variables.action === "history") {
        return;
      }
      if (sessionKey) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.dockerImages(sessionKey),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.dockerOverview(sessionKey),
          }),
        ]);
      }
    },
  });
}

export function useDockerVolumeActionMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: ({
      volumeName,
      action,
    }: {
      volumeName: string;
      action: DockerVolumeAction;
    }) => runRemoteDockerVolumeAction(volumeName, action),
    onSuccess: async (_data, variables) => {
      if (variables.action === "inspect") {
        return;
      }
      if (sessionKey) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.dockerVolumes(sessionKey),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.dockerOverview(sessionKey),
          }),
        ]);
      }
    },
  });
}

export function useDockerNetworkActionMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: ({
      networkRef,
      action,
    }: {
      networkRef: string;
      action: DockerNetworkAction;
    }) => runRemoteDockerNetworkAction(networkRef, action),
    onSuccess: async (_data, variables) => {
      if (variables.action === "inspect") {
        return;
      }
      if (sessionKey) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.dockerNetworks(sessionKey),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.dockerOverview(sessionKey),
          }),
        ]);
      }
    },
  });
}

export function useDockerSystemActionMutation() {
  const invalidateLists = useInvalidateDockerLists();

  return useMutation({
    mutationFn: (action: DockerSystemAction) =>
      runRemoteDockerSystemAction(action),
    onSuccess: async (_data, action) => {
      if (
        action === "prune" ||
        action === "prune-all" ||
        action === "prune-volumes"
      ) {
        await invalidateLists();
      }
    },
  });
}
