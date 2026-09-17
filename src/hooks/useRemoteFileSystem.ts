import { useCallback, useEffect, useState } from "react";
import {
  useCreateRemoteDirectoryMutation,
  useCreateRemoteFileMutation,
  useDeleteRemotePathMutation,
  useRemoteDirectoryQuery,
  useRemoteHomeQuery,
  useWriteRemoteFileMutation,
} from "@/hooks/query";
import type { RemoteEntry } from "@/types/filesystem";
import {
  buildPathFromSegments,
  isValidRemoteEntryName,
  joinRemotePath,
  splitPathSegments,
} from "@/utils/file";

interface UseRemoteFileSystemResult {
  currentPath: string;
  entries: RemoteEntry[];
  isLoading: boolean;
  errorMessage: string | null;
  selectedPath: string | null;
  refresh: () => Promise<void>;
  openDirectory: (path: string) => Promise<void>;
  openEntry: (entry: RemoteEntry) => Promise<void>;
  goUp: () => Promise<void>;
  selectEntry: (path: string | null) => void;
  createDirectory: (name: string) => Promise<void>;
  createFile: (name: string, content?: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "원격 파일 목록을 불러오지 못했습니다.";
}

export function useRemoteFileSystem(): UseRemoteFileSystemResult {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const homeQuery = useRemoteHomeQuery({ enabled: currentPath == null });
  const directoryQuery = useRemoteDirectoryQuery(currentPath, {
    enabled: currentPath != null,
  });

  const createDirMutation = useCreateRemoteDirectoryMutation();
  const createFileMutation = useCreateRemoteFileMutation();
  const writeFileMutation = useWriteRemoteFileMutation();
  const deleteMutation = useDeleteRemotePathMutation();

  useEffect(() => {
    if (currentPath != null) {
      return;
    }
    if (homeQuery.isSuccess && homeQuery.data) {
      setCurrentPath(homeQuery.data);
    }
  }, [currentPath, homeQuery.data, homeQuery.isSuccess]);

  useEffect(() => {
    if (directoryQuery.data) {
      setCurrentPath(directoryQuery.data.path);
      setSelectedPath(null);
      setLocalError(null);
    }
  }, [directoryQuery.data]);

  const resolvedPath = directoryQuery.data?.path ?? currentPath ?? "/";
  const entries = directoryQuery.data?.entries ?? [];

  const isMutating =
    createDirMutation.isPending ||
    createFileMutation.isPending ||
    writeFileMutation.isPending ||
    deleteMutation.isPending;

  const isLoading =
    (currentPath == null && homeQuery.isPending) ||
    (currentPath != null && directoryQuery.isPending) ||
    directoryQuery.isFetching ||
    isMutating;

  const errorMessage =
    localError ??
    (homeQuery.isError && currentPath == null
      ? getErrorMessage(homeQuery.error)
      : null) ??
    (directoryQuery.isError
      ? getErrorMessage(directoryQuery.error)
      : null) ??
    (createDirMutation.error
      ? getErrorMessage(createDirMutation.error)
      : null) ??
    (createFileMutation.error
      ? getErrorMessage(createFileMutation.error)
      : null) ??
    (writeFileMutation.error
      ? getErrorMessage(writeFileMutation.error)
      : null) ??
    (deleteMutation.error ? getErrorMessage(deleteMutation.error) : null);

  const openDirectory = useCallback(async (path: string) => {
    setLocalError(null);
    setSelectedPath(null);
    setCurrentPath(path);
  }, []);

  const openEntry = useCallback(
    async (entry: RemoteEntry) => {
      if (entry.isDirectory) {
        await openDirectory(entry.path);
        return;
      }
      setSelectedPath(entry.path);
    },
    [openDirectory],
  );

  const goUp = useCallback(async () => {
    const segments = splitPathSegments(resolvedPath);
    if (segments.length === 0) {
      return;
    }
    segments.pop();
    await openDirectory(buildPathFromSegments(segments));
  }, [openDirectory, resolvedPath]);

  const refresh = useCallback(async () => {
    setLocalError(null);
    await directoryQuery.refetch();
  }, [directoryQuery]);

  const selectEntry = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const createDirectory = useCallback(
    async (name: string) => {
      if (!isValidRemoteEntryName(name)) {
        const message = "올바른 폴더 이름을 입력하세요.";
        setLocalError(message);
        throw new Error(message);
      }
      setLocalError(null);
      try {
        await createDirMutation.mutateAsync(
          joinRemotePath(resolvedPath, name),
        );
        await directoryQuery.refetch();
      } catch (error) {
        setLocalError(getErrorMessage(error));
        throw error;
      }
    },
    [createDirMutation, directoryQuery, resolvedPath],
  );

  const createFile = useCallback(
    async (name: string, content = "") => {
      if (!isValidRemoteEntryName(name)) {
        const message = "올바른 파일 이름을 입력하세요.";
        setLocalError(message);
        throw new Error(message);
      }
      setLocalError(null);
      const path = joinRemotePath(resolvedPath, name);
      try {
        await createFileMutation.mutateAsync(path);
        if (content.length > 0) {
          await writeFileMutation.mutateAsync({ path, content });
        }
        await directoryQuery.refetch();
      } catch (error) {
        setLocalError(getErrorMessage(error));
        throw error;
      }
    },
    [createFileMutation, directoryQuery, resolvedPath, writeFileMutation],
  );

  const deleteEntry = useCallback(
    async (path: string) => {
      setLocalError(null);
      try {
        await deleteMutation.mutateAsync(path);
        await directoryQuery.refetch();
      } catch (error) {
        setLocalError(getErrorMessage(error));
      }
    },
    [deleteMutation, directoryQuery],
  );

  return {
    currentPath: resolvedPath,
    entries,
    isLoading,
    errorMessage,
    selectedPath,
    refresh,
    openDirectory,
    openEntry,
    goUp,
    selectEntry,
    createDirectory,
    createFile,
    deleteEntry,
  };
}
