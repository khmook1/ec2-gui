import { useEffect, useState } from "react";
import { CommitDetail } from "@/components/github/atoms/CommitDetail";
import { CodeIcon, CommitIcon, CopyIcon } from "@/components/icons/GitHubIcons";
import { CheckIcon } from "@/components/icons/ToolbarIcons";
import { openExternalUrl } from "@/services/tauri";
import type { WeeklyCommit } from "@/types/github";

const COPIED_FEEDBACK_MS = 1500;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDayHeading(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

function formatRelative(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 최신순으로 정렬해 로컬 날짜별로 묶는다. */
function groupByDay(
  commits: WeeklyCommit[],
): { heading: string; commits: WeeklyCommit[] }[] {
  const sorted = [...commits].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  );
  const groups: { key: string; heading: string; commits: WeeklyCommit[] }[] =
    [];
  for (const commit of sorted) {
    const date = new Date(commit.date);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.commits.push(commit);
    } else {
      groups.push({ key, heading: formatDayHeading(date), commits: [commit] });
    }
  }
  return groups;
}

function treeUrl(commit: WeeklyCommit): string {
  return `https://github.com/${commit.repo}/tree/${commit.sha}`;
}

function CommitRow({ commit }: { commit: WeeklyCommit }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [title = "", ...rest] = commit.message.split("\n");
  const body = rest.join("\n").trim();
  const date = new Date(commit.date);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(commit.sha);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const toggle = () => setExpanded((value) => !value);

  return (
    <li
      className={["gh-commit", expanded ? "gh-commit--expanded" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="gh-commit__row">
        <div className="gh-commit__main">
          <div className="gh-commit__title-row">
            <button
              type="button"
              className="gh-commit__title"
              title={title}
              aria-expanded={expanded}
              onClick={toggle}
            >
              {title}
            </button>
            <button
              type="button"
              className="gh-commit__ellipsis"
              aria-expanded={expanded}
              aria-label={expanded ? "커밋 상세 접기" : "커밋 상세 보기"}
              title={expanded ? "상세 접기" : "변경 내용 보기"}
              onClick={toggle}
            >
              …
            </button>
          </div>
          <div className="gh-commit__meta">
            {commit.authorAvatarUrl ? (
              <img
                className="gh-commit__avatar"
                src={commit.authorAvatarUrl}
                alt=""
                width={16}
                height={16}
              />
            ) : null}
            {commit.authorLogin ? (
              <span className="gh-commit__author">{commit.authorLogin}</span>
            ) : null}
            <span title={date.toLocaleString()}>
              committed {formatRelative(date)}
            </span>
            <span className="gh-commit__repo">{commit.repo}</span>
          </div>
        </div>
        <div className="gh-commit__actions">
          <div className="gh-commit__btn-group">
            <button
              type="button"
              className="gh-commit__btn gh-commit__sha"
              title="GitHub에서 커밋 보기"
              onClick={() => void openExternalUrl(commit.url)}
            >
              {commit.sha.slice(0, 7)}
            </button>
            <button
              type="button"
              className="gh-commit__btn gh-commit__icon-btn"
              title={copied ? "복사됨" : "전체 SHA 복사"}
              aria-label="전체 SHA 복사"
              onClick={() => void handleCopy()}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          <button
            type="button"
            className="gh-commit__btn gh-commit__icon-btn"
            title="이 시점의 저장소 둘러보기"
            aria-label="이 시점의 저장소 둘러보기"
            onClick={() => void openExternalUrl(treeUrl(commit))}
          >
            <CodeIcon />
          </button>
        </div>
      </div>
      {expanded ? (
        <CommitDetail repo={commit.repo} sha={commit.sha} body={body} />
      ) : null}
    </li>
  );
}

export function CommitList({ commits }: { commits: WeeklyCommit[] }) {
  if (commits.length === 0) {
    return (
      <p className="github-report__empty">
        해당 기간에 작성한 커밋이 없습니다.
      </p>
    );
  }

  return (
    <div className="gh-commits">
      {groupByDay(commits).map((group) => (
        <section key={group.heading} className="gh-commits__day">
          <h4 className="gh-commits__heading">
            <CommitIcon className="gh-commits__heading-icon" />
            Commits on {group.heading}
          </h4>
          <ul className="gh-commits__box">
            {group.commits.map((commit) => (
              <CommitRow key={`${commit.repo}@${commit.sha}`} commit={commit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
