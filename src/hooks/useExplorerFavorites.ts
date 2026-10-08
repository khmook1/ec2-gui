import { useCallback, useMemo } from "react";
import {
  useRemoteFavoritesQuery,
  useSetRemoteFavoriteMutation,
} from "@/hooks/query";
import type { RemoteEntry } from "@/types/filesystem";
import { getParentPath } from "@/utils/file";

const EMPTY_FAVORITES: RemoteEntry[] = [];

function trimTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * 이 컴퓨터의 앱 데이터(`favorites.json`)에 서버별로 저장된 파일 탐색기 즐겨찾기.
 * 즐겨찾기는 어느 폴더를 보고 있든 목록 맨 앞에 바로가기로 노출한다.
 */
export function useExplorerFavorites(entries: RemoteEntry[], currentPath: string) {
  const favoritesQuery = useRemoteFavoritesQuery();
  const { mutate } = useSetRemoteFavoriteMutation();
  const favorites = favoritesQuery.data ?? EMPTY_FAVORITES;

  const favoriteSet = useMemo(
    () => new Set(favorites.map((entry) => entry.path)),
    [favorites],
  );

  const isFavorite = useCallback(
    (path: string) => favoriteSet.has(path),
    [favoriteSet],
  );

  /** 현재 폴더 밖에 있는 즐겨찾기(바로가기로만 노출되는 항목) */
  const isShortcut = useCallback(
    (entry: RemoteEntry) =>
      favoriteSet.has(entry.path) && getParentPath(entry.path) !== currentPath,
    [currentPath, favoriteSet],
  );

  const displayEntries = useMemo(() => {
    if (favorites.length === 0) {
      return entries;
    }
    const localByPath = new Map(entries.map((entry) => [entry.path, entry]));
    const current = trimTrailingSlash(currentPath);
    const pinned = favorites
      .filter((entry) => !(entry.isDirectory && trimTrailingSlash(entry.path) === current))
      .map((entry) => localByPath.get(entry.path) ?? entry);
    const others = entries.filter((entry) => !favoriteSet.has(entry.path));
    return [...pinned, ...others];
  }, [currentPath, entries, favoriteSet, favorites]);

  const toggleFavorite = useCallback(
    (entry: RemoteEntry) => {
      mutate({ entry, favorite: !favoriteSet.has(entry.path) });
    },
    [favoriteSet, mutate],
  );

  return { displayEntries, isFavorite, isShortcut, toggleFavorite };
}
