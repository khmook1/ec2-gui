import { SearchHighlight } from "@/components/common/SearchHighlight";
import { ResourceCard } from "@/components/common/ResourceCard";
import { RepoBadges } from "@/components/github/atoms/RepoBadges";
import { RepoGitHubIcon } from "@/components/icons/GitHubIcons";
import {
  formatRepoPushedAt,
  useFilteredGitHubRepos,
} from "@/lib/useFilteredGitHubRepos";
import { useListSelection } from "@/providers/ListSelectionProvider";
import { useGitHubStore } from "@/stores/githubStore";
import type { GitHubRepo } from "@/types/github";
import "@/components/explorer/css/file-icon-grid.css";
import "../css/github.css";

interface RepoGridProps {
  repos: GitHubRepo[];
}

export function RepoGrid({ repos }: RepoGridProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const openRepo = useGitHubStore((state) => state.openRepo);
  const { filtered, query, emptyMessage } = useFilteredGitHubRepos(repos);

  if (filtered.length === 0) {
    return (
      <div
        className="explorer-icon-grid explorer-icon-grid--empty"
        role="status"
        onMouseDown={() => clearSelection()}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="explorer-icon-grid explorer-icon-grid--github resource-card-grid"
      role="list"
      aria-label="GitHub 저장소 카드 목록"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection();
        }
      }}
    >
      {filtered.map((repo) => {
        const selected = selectedKey === repo.fullName;

        return (
          <ResourceCard
            key={repo.fullName}
            tone="github"
            selected={selected}
            icon={<RepoGitHubIcon />}
            overline={repo.owner}
            name={<SearchHighlight text={repo.name} query={query} />}
            description={
              <SearchHighlight
                text={repo.description || "설명이 없는 저장소"}
                query={query}
              />
            }
            badges={<RepoBadges repo={repo} />}
            accessory={<span aria-hidden="true">↗</span>}
            footer={
              <>
                <span>업데이트 {formatRepoPushedAt(repo.pushedAt)}</span>
                {repo.stargazers > 0 ? (
                  <span className="resource-card__footer-end">
                    <span aria-hidden="true">★</span>
                    {repo.stargazers.toLocaleString("ko-KR")}
                  </span>
                ) : null}
              </>
            }
            buttonProps={{
              title: [repo.fullName, repo.description]
                .filter(Boolean)
                .join("\n"),
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                select(repo.fullName);
                openRepo(repo.fullName);
              },
            }}
          />
        );
      })}
    </div>
  );
}
