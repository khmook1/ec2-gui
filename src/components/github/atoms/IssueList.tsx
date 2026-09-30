import type { ReactNode } from "react";
import { CommentIcon } from "@/components/icons/GitHubIcons";
import { IssueLabels } from "@/components/github/atoms/IssueLabels";
import { StateBadge } from "@/components/github/atoms/StateBadge";
import { formatGitHubTime } from "@/lib/github";
import type {
  GitHubIssueState,
  GitHubLabel,
  GitHubUser,
} from "@/types/github";

export interface IssueListItem {
  number: number;
  title: string;
  state: GitHubIssueState;
  merged?: boolean;
  draft?: boolean;
  user: GitHubUser;
  createdAt: string;
  labels?: GitHubLabel[];
  comments?: number | null;
  /** 제목 아래 추가 정보 (PR 브랜치 등) */
  extra?: ReactNode;
}

interface IssueListProps {
  items: IssueListItem[];
  emptyText: string;
  onOpen: (number: number) => void;
}

/** 이슈·PR 공통 목록 */
export function IssueList({ items, emptyText, onOpen }: IssueListProps) {
  if (items.length === 0) {
    return <p className="github-list__empty">{emptyText}</p>;
  }
  return (
    <ul className="github-list" role="list">
      {items.map((item) => (
        <li key={item.number}>
          <button
            type="button"
            className="github-list__row"
            onClick={() => onOpen(item.number)}
          >
            <StateBadge
              state={item.state}
              merged={item.merged}
              draft={item.draft}
            />
            <span className="github-list__main">
              <span className="github-list__title">
                {item.title}
                {item.labels ? <IssueLabels labels={item.labels} /> : null}
              </span>
              <span className="github-list__sub">
                #{item.number} · {item.user.login} · {formatGitHubTime(item.createdAt)}
                {item.extra ? <> · {item.extra}</> : null}
              </span>
            </span>
            {item.comments ? (
              <span className="github-list__comments">
                <CommentIcon />
                {item.comments}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
