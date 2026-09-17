import { useMemo } from "react";
import { useListSearchStats } from "@/hooks/useListSearchStats";
import { useListSearch } from "@/providers/ListSearchProvider";
import type { DockerImage, DockerNetwork, DockerVolume } from "@/types/docker";
import {
  matchesAnyListSearch,
  normalizeListSearchQuery,
} from "@/utils/listSearch";

export function shortDockerId(id: string): string {
  const bare = id.replace(/^sha256:/, "");
  return bare.length > 12 ? bare.slice(0, 12) : bare;
}

export function useFilteredDockerImages(images: DockerImage[]) {
  const { query } = useListSearch();

  const filtered = useMemo(() => {
    const normalized = normalizeListSearchQuery(query);
    if (!normalized) {
      return images;
    }

    return images.filter((image) =>
      matchesAnyListSearch(
        [
          image.id,
          shortDockerId(image.id),
          image.repository,
          image.tag,
          image.createdSince,
          image.size,
          `${image.repository}:${image.tag}`,
        ],
        query,
      ),
    );
  }, [images, query]);

  useListSearchStats(images.length, filtered.length);

  const emptyMessage =
    images.length === 0
      ? "이미지가 없습니다."
      : normalizeListSearchQuery(query)
        ? "검색 결과가 없습니다."
        : "데이터가 없습니다.";

  return { filtered, query, emptyMessage };
}

export function useFilteredDockerNetworks(networks: DockerNetwork[]) {
  const { query } = useListSearch();

  const filtered = useMemo(() => {
    const normalized = normalizeListSearchQuery(query);
    if (!normalized) {
      return networks;
    }

    return networks.filter((network) =>
      matchesAnyListSearch(
        [
          network.id,
          shortDockerId(network.id),
          network.name,
          network.driver,
          network.scope,
        ],
        query,
      ),
    );
  }, [networks, query]);

  useListSearchStats(networks.length, filtered.length);

  const emptyMessage =
    networks.length === 0
      ? "네트워크가 없습니다."
      : normalizeListSearchQuery(query)
        ? "검색 결과가 없습니다."
        : "데이터가 없습니다.";

  return { filtered, query, emptyMessage };
}

export function useFilteredDockerVolumes(volumes: DockerVolume[]) {
  const { query } = useListSearch();

  const filtered = useMemo(() => {
    const normalized = normalizeListSearchQuery(query);
    if (!normalized) {
      return volumes;
    }

    return volumes.filter((volume) =>
      matchesAnyListSearch(
        [volume.name, volume.driver, volume.mountpoint, volume.scope],
        query,
      ),
    );
  }, [volumes, query]);

  useListSearchStats(volumes.length, filtered.length);

  const emptyMessage =
    volumes.length === 0
      ? "볼륨이 없습니다."
      : normalizeListSearchQuery(query)
        ? "검색 결과가 없습니다."
        : "데이터가 없습니다.";

  return { filtered, query, emptyMessage };
}
