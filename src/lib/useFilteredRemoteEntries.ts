import { useMemo } from "react";
import { useListSearchStats } from "@/hooks/useListSearchStats";
import { useListSearch } from "@/providers/ListSearchProvider";
import type { RemoteEntry } from "@/types/filesystem";
import {
  formatFileSize,
  formatModifiedTime,
  getEntryKindLabel,
} from "@/utils/file";
import { matchesAnyListSearch, normalizeListSearchQuery } from "@/utils/listSearch";

export function useFilteredRemoteEntries(entries: RemoteEntry[]) {
  const { query } = useListSearch();

  const filteredEntries = useMemo(() => {
    const normalized = normalizeListSearchQuery(query);
    if (!normalized) {
      return entries;
    }

    return entries.filter((entry) => {
      const dateLabel = formatModifiedTime(entry.modifiedAt);
      const sizeLabel = entry.isDirectory ? "—" : formatFileSize(entry.size);
      const kindLabel = getEntryKindLabel(entry.isDirectory, entry.name);

      return matchesAnyListSearch(
        [entry.name, dateLabel, sizeLabel, kindLabel, entry.path],
        query,
      );
    });
  }, [entries, query]);

  useListSearchStats(entries.length, filteredEntries.length);

  const emptyMessage = normalizeListSearchQuery(query)
    ? "검색 결과가 없습니다."
    : entries.length === 0
      ? "이 폴더는 비어 있습니다."
      : "데이터가 없습니다.";

  return { filteredEntries, query, emptyMessage };
}
