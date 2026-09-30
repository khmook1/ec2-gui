import { useMemo } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import {
  TableList,
  type TableColumnSetting,
} from "@/components/common/TableList";
import { RepoBadges } from "@/components/github/atoms/RepoBadges";
import {
  formatRepoPushedAt,
  useFilteredGitHubRepos,
} from "@/lib/useFilteredGitHubRepos";
import { useListSelection } from "@/providers/ListSelectionProvider";
import { useGitHubStore } from "@/stores/githubStore";
import type { GitHubRepo } from "@/types/github";
import "../css/github.css";

interface RepoListProps {
  repos: GitHubRepo[];
}

export function RepoList({ repos }: RepoListProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const openRepo = useGitHubStore((state) => state.openRepo);
  const { filtered, query, emptyMessage } = useFilteredGitHubRepos(repos);

  const settings = useMemo<TableColumnSetting<GitHubRepo>[]>(
    () => [
      {
        name: "저장소",
        render: (repo) => (
          <span className="github-repo__name-cell">
            <span className="github-repo__name" title={repo.htmlUrl}>
              <SearchHighlight text={repo.fullName} query={query} />
            </span>
            <RepoBadges repo={repo} />
          </span>
        ),
      },
      {
        name: "설명",
        className: "table-list__cell-muted",
        render: (repo) => (
          <span className="github-repo__desc" title={repo.description ?? ""}>
            <SearchHighlight text={repo.description || "—"} query={query} />
          </span>
        ),
      },
      {
        name: "언어",
        width: 120,
        className: "table-list__cell-muted",
        render: (repo) => (
          <SearchHighlight text={repo.language || "—"} query={query} />
        ),
      },
      {
        name: "Stars",
        width: 72,
        className: "table-list__cell-muted",
        render: (repo) => repo.stargazers.toLocaleString("ko-KR"),
      },
      {
        name: "최근 Push",
        width: 160,
        className: "table-list__cell-muted",
        render: (repo) => formatRepoPushedAt(repo.pushedAt),
      },
    ],
    [query],
  );

  return (
    <TableList
      list={filtered}
      settings={settings}
      ariaLabel="GitHub 저장소"
      getRowKey={(repo) => repo.fullName}
      emptyMessage={emptyMessage}
      onBackgroundClick={clearSelection}
      onRowClick={(repo) => {
        select(repo.fullName);
        openRepo(repo.fullName);
      }}
      getRowClassName={(repo) =>
        selectedKey === repo.fullName ? "table-list__row--selected" : undefined
      }
    />
  );
}
