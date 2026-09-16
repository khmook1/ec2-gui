import { useCallback, useEffect, useState } from "react";
import {
  createRemoteDirectory,
  createRemoteFile,
  deleteRemotePath,
  getRemoteHome,
  listRemoteDirectory,
} from "@/services/tauri/filesystem";
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
  createFile: (name: string) => Promise<void>;
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
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const listing = await listRemoteDirectory(path);
      setCurrentPath(listing.path);
      setEntries(listing.entries);
      setSelectedPath(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      try {
        const home = await getRemoteHome();
        if (!cancelled) {
          setIsInitialized(true);
          await loadDirectory(home);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isInitialized, loadDirectory]);

  const openDirectory = useCallback(
    async (path: string) => {
      await loadDirectory(path);
    },
    [loadDirectory],
  );

  const openEntry = useCallback(
    async (entry: RemoteEntry) => {
      if (entry.isDirectory) {
        await loadDirectory(entry.path);
        return;
      }
      setSelectedPath(entry.path);
    },
    [loadDirectory],
  );

  const goUp = useCallback(async () => {
    const segments = splitPathSegments(currentPath);
    if (segments.length === 0) {
      return;
    }
    segments.pop();
    await loadDirectory(buildPathFromSegments(segments));
  }, [currentPath, loadDirectory]);

  const refresh = useCallback(async () => {
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const selectEntry = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const createDirectory = useCallback(
    async (name: string) => {
      if (!isValidRemoteEntryName(name)) {
        setErrorMessage("올바른 폴더 이름을 입력하세요.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        await createRemoteDirectory(joinRemotePath(currentPath, name));
        await loadDirectory(currentPath);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
        setIsLoading(false);
      }
    },
    [currentPath, loadDirectory],
  );

  const createFile = useCallback(
    async (name: string) => {
      if (!isValidRemoteEntryName(name)) {
        setErrorMessage("올바른 파일 이름을 입력하세요.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        await createRemoteFile(joinRemotePath(currentPath, name));
        await loadDirectory(currentPath);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
        setIsLoading(false);
      }
    },
    [currentPath, loadDirectory],
  );

  const deleteEntry = useCallback(
    async (path: string) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await deleteRemotePath(path);
        await loadDirectory(currentPath);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
        setIsLoading(false);
      }
    },
    [currentPath, loadDirectory],
  );

  return {
    currentPath,
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
