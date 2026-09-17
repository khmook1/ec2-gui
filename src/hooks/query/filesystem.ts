import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  createRemoteDirectory,
  createRemoteFile,
  deleteRemotePath,
  getRemoteHome,
  listRemoteDirectory,
  readRemoteFile,
} from "@/services/tauri/filesystem";

export function useRemoteHomeQuery(options?: { enabled?: boolean }) {
  const sessionKey = useSessionKey();
  const enabled = Boolean(sessionKey) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.remoteHome(sessionKey ?? ""),
    queryFn: getRemoteHome,
    enabled,
  });
}

export function useRemoteDirectoryQuery(
  path: string | null,
  options?: { enabled?: boolean },
) {
  const sessionKey = useSessionKey();
  const enabled =
    Boolean(sessionKey && path) && (options?.enabled ?? true);

  return useQuery({
    queryKey: queryKeys.remoteDir(sessionKey ?? "", path ?? ""),
    queryFn: () => listRemoteDirectory(path!),
    enabled,
  });
}

export function useRemoteFileQuery(path: string | null) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.remoteFile(sessionKey ?? "", path ?? ""),
    queryFn: () => readRemoteFile(path!),
    enabled: Boolean(sessionKey && path),
  });
}

export function useCreateRemoteDirectoryMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: (path: string) => createRemoteDirectory(path),
    onSuccess: async (_data, path) => {
      if (!sessionKey) {
        return;
      }
      const parent = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/")) || "/"
        : "/";
      await queryClient.invalidateQueries({
        queryKey: queryKeys.remoteDir(sessionKey, parent),
      });
    },
  });
}

export function useCreateRemoteFileMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: (path: string) => createRemoteFile(path),
    onSuccess: async (_data, path) => {
      if (!sessionKey) {
        return;
      }
      const parent = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/")) || "/"
        : "/";
      await queryClient.invalidateQueries({
        queryKey: queryKeys.remoteDir(sessionKey, parent),
      });
    },
  });
}

export function useDeleteRemotePathMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationFn: (path: string) => deleteRemotePath(path),
    onSuccess: async (_data, path) => {
      if (!sessionKey) {
        return;
      }
      const parent = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/")) || "/"
        : "/";
      await queryClient.invalidateQueries({
        queryKey: queryKeys.remoteDir(sessionKey, parent),
      });
      await queryClient.removeQueries({
        queryKey: queryKeys.remoteFile(sessionKey, path),
      });
    },
  });
}
