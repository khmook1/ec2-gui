import { SearchHighlight } from "@/components/common/SearchHighlight";
import { RepoBadges } from "@/components/github/atoms/RepoBadges";
import { GitHubNavIcon } from "@/components/icons/NavIcons";
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
      className="explorer-icon-grid explorer-icon-grid--github"
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
        const meta = [
          repo.language,
          repo.stargazers > 0 ? `★ ${repo.stargazers.toLocaleString("ko-KR")}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <button
            key={repo.fullName}
            type="button"
            role="listitem"
            className={[
              "explorer-icon-grid__item",
              "explorer-icon-grid__item--github",
              "github-grid__card--clickable",
              selected ? "explorer-icon-grid__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={[repo.fullName, repo.description].filter(Boolean).join("\n")}
            aria-pressed={selected}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(repo.fullName);
              openRepo(repo.fullName);
            }}
          >
            <GitHubNavIcon className="github-grid__icon" />
            <span className="explorer-icon-grid__name github-grid__name">
              <SearchHighlight text={repo.name} query={query} />
            </span>
            <span className="github-grid__owner">{repo.owner}</span>
            <RepoBadges repo={repo} />
            <span className="github-grid__desc">
              <SearchHighlight text={repo.description || "설명 없음"} query={query} />
            </span>
            <span className="github-grid__meta">
              {meta ? <SearchHighlight text={meta} query={query} /> : null}
              <span>{formatRepoPushedAt(repo.pushedAt)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
