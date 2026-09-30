import { useMemo } from "react";
import { useListSearchStats } from "@/hooks/useListSearchStats";
import { useListSearch } from "@/providers/ListSearchProvider";
import type { GitHubRepo } from "@/types/github";
import {
  matchesAnyListSearch,
  normalizeListSearchQuery,
} from "@/utils/listSearch";
import { formatModifiedTime } from "@/utils/file";

export function formatRepoPushedAt(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "—" : formatModifiedTime(time / 1000);
}

/** 현재 페이지에 받아온 저장소만 대상으로 ⌘F 검색을 적용한다. */
export function useFilteredGitHubRepos(repos: GitHubRepo[]) {
  const { query } = useListSearch();

  const filtered = useMemo(() => {
    if (!normalizeListSearchQuery(query)) {
      return repos;
    }
    return repos.filter((repo) =>
      matchesAnyListSearch(
        [repo.fullName, repo.description ?? "", repo.language ?? ""],
        query,
      ),
    );
  }, [repos, query]);

  useListSearchStats(repos.length, filtered.length);

  const emptyMessage =
    repos.length === 0
      ? "저장소가 없습니다."
      : normalizeListSearchQuery(query)
        ? "현재 페이지에 검색 결과가 없습니다."
        : "데이터가 없습니다.";

  return { filtered, query, emptyMessage };
}
