import { useMemo } from "react";
import { useListSearchStats } from "@/hooks/useListSearchStats";
import { useListSearch } from "@/providers/ListSearchProvider";
import type { DockerContainer } from "@/types/docker";
import { matchesAnyListSearch, normalizeListSearchQuery } from "@/utils/listSearch";

export function shortContainerId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) : id;
}

export function useFilteredDockerContainers(containers: DockerContainer[]) {
  const { query } = useListSearch();

  const filteredContainers = useMemo(() => {
    const normalized = normalizeListSearchQuery(query);
    if (!normalized) {
      return containers;
    }

    return containers.filter((container) =>
      matchesAnyListSearch(
        [
          container.id,
          shortContainerId(container.id),
          container.image,
          container.status,
          container.names,
          container.ports,
        ],
        query,
      ),
    );
  }, [containers, query]);

  useListSearchStats(containers.length, filteredContainers.length);

  const emptyMessage =
    containers.length === 0
      ? "실행 중인 컨테이너가 없습니다."
      : normalizeListSearchQuery(query)
        ? "검색 결과가 없습니다."
        : "데이터가 없습니다.";

  return { filteredContainers, query, emptyMessage };
}
