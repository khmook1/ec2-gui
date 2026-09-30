import { useCallback, useMemo } from "react";
import {
  useDockerFavoritesQuery,
  useSetDockerFavoriteMutation,
} from "@/hooks/query";
import type { DockerContainer } from "@/types/docker";

const EMPTY_NAMES: string[] = [];

/**
 * 이 컴퓨터의 앱 데이터(`favorites.json`)에 서버별로 저장된 컨테이너 즐겨찾기.
 * 재생성돼도 유지되도록 컨테이너 이름 기준이며, 즐겨찾기는 기존 순서를 유지한 채 맨 앞으로 올린다.
 */
export function useDockerFavorites(containers: DockerContainer[]) {
  const favoritesQuery = useDockerFavoritesQuery();
  const { mutate } = useSetDockerFavoriteMutation();
  const favoriteNames = favoritesQuery.data ?? EMPTY_NAMES;

  const favoriteSet = useMemo(() => new Set(favoriteNames), [favoriteNames]);

  const isFavorite = useCallback(
    (container: DockerContainer) => favoriteSet.has(container.names),
    [favoriteSet],
  );

  const sortedContainers = useMemo(() => {
    if (favoriteSet.size === 0) {
      return containers;
    }
    const favorites: DockerContainer[] = [];
    const others: DockerContainer[] = [];
    for (const container of containers) {
      (favoriteSet.has(container.names) ? favorites : others).push(container);
    }
    return favorites.length === 0 ? containers : [...favorites, ...others];
  }, [containers, favoriteSet]);

  const toggleFavorite = useCallback(
    (container: DockerContainer) => {
      mutate({
        name: container.names,
        favorite: !favoriteSet.has(container.names),
      });
    },
    [favoriteSet, mutate],
  );

  return { sortedContainers, isFavorite, toggleFavorite };
}
