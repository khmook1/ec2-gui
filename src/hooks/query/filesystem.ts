import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import {
  createRemoteDirectory,
  createRemoteFile,
  deleteRemotePath,
  getRemoteHome,
  listRemoteDirectory,
  listRemoteFavorites,
  readRemoteFile,
  setRemoteFavorite,
  writeRemoteFile,
  writeRemoteFileWithSudo,
} from "@/services/tauri/filesystem";
import type { RemoteEntry } from "@/types/filesystem";

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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.remoteFavorites(sessionKey),
      });
    },
  });
}

const SET_FAVORITE_MUTATION_KEY = ["fs", "setFavorite"] as const;

export function useRemoteFavoritesQuery() {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.remoteFavorites(sessionKey ?? ""),
    queryFn: listRemoteFavorites,
    enabled: Boolean(sessionKey),
    staleTime: Infinity,
  });
}

export function useSetRemoteFavoriteMutation() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return useMutation({
    mutationKey: SET_FAVORITE_MUTATION_KEY,
    mutationFn: ({ entry, favorite }: { entry: RemoteEntry; favorite: boolean }) =>
      setRemoteFavorite(entry.path, favorite),
    onMutate: async ({ entry, favorite }) => {
      if (!sessionKey) {
        return { previous: undefined };
      }
      const key = queryKeys.remoteFavorites(sessionKey);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RemoteEntry[]>(key);
      const current = previous ?? [];
      const exists = current.some((item) => item.path === entry.path);
      queryClient.setQueryData<RemoteEntry[]>(
        key,
        favorite
          ? exists
            ? current
            : [...current, entry]
          : current.filter((item) => item.path !== entry.path),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!sessionKey) {
        return;
      }
      queryClient.setQueryData(
        queryKeys.remoteFavorites(sessionKey),
        context?.previous,
      );
    },
    onSuccess: (favorites) => {
      if (!sessionKey) {
        return;
      }
      // 연속 토글 중 먼저 끝난 응답이 뒤 토글의 낙관적 상태를 덮어쓰지 않도록 마지막 응답만 반영
      if (
        queryClient.isMutating({ mutationKey: SET_FAVORITE_MUTATION_KEY }) > 1
      ) {
        return;
      }
      queryClient.setQueryData(queryKeys.remoteFavorites(sessionKey), favorites);
    },
  });
}

function useInvalidateWrittenFile() {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();

  return async (path: string) => {
    if (!sessionKey) {
      return;
    }
    const parent = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/")) || "/"
      : "/";
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.remoteFile(sessionKey, path),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.remoteDir(sessionKey, parent),
      }),
    ]);
  };
}

export function useWriteRemoteFileMutation() {
  const invalidateWrittenFile = useInvalidateWrittenFile();

  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      writeRemoteFile(path, content),
    onSuccess: (_data, { path }) => invalidateWrittenFile(path),
  });
}

export function useWriteRemoteFileWithSudoMutation() {
  const invalidateWrittenFile = useInvalidateWrittenFile();

  return useMutation({
    mutationFn: ({
      path,
      content,
      password,
    }: {
      path: string;
      content: string;
      password?: string;
    }) => writeRemoteFileWithSudo(path, content, password),
    onSuccess: (_data, { path }) => invalidateWrittenFile(path),
  });
}
