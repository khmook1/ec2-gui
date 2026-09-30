import { useState } from "react";
import { Button } from "@/components/common/Button";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { ArrowLeftIcon } from "@/components/icons/GitHubIcons";
import { MergePullDialog } from "@/components/github/MergePullDialog";
import { CommentCard, CommentThread } from "@/components/github/atoms/CommentThread";
import { StateBadge } from "@/components/github/atoms/StateBadge";
import {
  useGitHubPullQuery,
  useGitHubViewerQuery,
  useSetGitHubPullStateMutation,
} from "@/hooks/query";
import { formatGitHubTime, githubErrorMessage } from "@/lib/github";
import type { GitHubPull, GitHubRepoDetail } from "@/types/github";

interface PullDetailProps {
  detail: GitHubRepoDetail;
  number: number;
  onBack: () => void;
}

/** GitHub `mergeable_state` 값을 안내 문구로 바꾼다 */
function mergeStatus(pull: GitHubPull): { tone: "ok" | "warn" | "muted"; text: string } {
  if (pull.draft) {
    return { tone: "muted", text: "Draft PR은 Ready for review 후 머지할 수 있습니다." };
  }
  if (pull.mergeable == null) {
    return { tone: "muted", text: "GitHub가 머지 가능 여부를 계산하는 중입니다. 잠시 후 새로고침하세요." };
  }
  if (!pull.mergeable || pull.mergeableState === "dirty") {
    return { tone: "warn", text: "충돌이 있어 자동으로 머지할 수 없습니다." };
  }
  switch (pull.mergeableState) {
    case "blocked":
      return { tone: "warn", text: "브랜치 보호 규칙(리뷰·체크)으로 머지가 막혀 있습니다." };
    case "behind":
      return { tone: "warn", text: "base 브랜치보다 뒤처져 있습니다. 머지는 가능할 수 있습니다." };
    case "unstable":
      return { tone: "warn", text: "일부 체크가 실패했지만 머지할 수 있습니다." };
    default:
      return { tone: "ok", text: "충돌 없이 머지할 수 있습니다." };
  }
}

export function PullDetail({ detail, number, onBack }: PullDetailProps) {
  const repo = detail.fullName;
  const pullQuery = useGitHubPullQuery(repo, number);
  const viewerQuery = useGitHubViewerQuery();
  const setState = useSetGitHubPullStateMutation(repo);
  const [mergeTarget, setMergeTarget] = useState<GitHubPull | null>(null);
  const pull = pullQuery.data;

  const { permissions } = detail;
  const canWrite = !detail.archived && (permissions.push || permissions.admin);
  const isAuthor = pull != null && viewerQuery.data?.login === pull.user.login;
  const canChangeState = !detail.archived && (canWrite || isAuthor);

  return (
    <div className="github-detail">
      <button type="button" className="github-back" onClick={onBack}>
        <ArrowLeftIcon />
        PR 목록
      </button>

      {pullQuery.isLoading ? (
        <LoadingIndicator message="PR을 불러오는 중" />
      ) : pullQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(pullQuery.error, "PR을 불러오지 못했습니다.")}
        </p>
      ) : pull ? (
        <>
          <header className="github-detail__header">
            <h2 className="github-detail__title">
              {pull.title}
              <span className="github-detail__number">#{pull.number}</span>
            </h2>
            <div className="github-detail__meta">
              <StateBadge
                state={pull.state}
                merged={pull.merged}
                draft={pull.draft}
                size="lg"
              />
              <span>
                <strong>{pull.user.login}</strong> 님이{" "}
                <code className="github-ref">{pull.headRef}</code> →{" "}
                <code className="github-ref">{pull.baseRef}</code>{" "}
                {pull.merged
                  ? `머지함 (${formatGitHubTime(pull.mergedAt)})`
                  : `요청 (${formatGitHubTime(pull.createdAt)})`}
              </span>
              {canChangeState && !pull.merged ? (
                <Button
                  variant="ghost"
                  className="github-detail__action"
                  disabled={setState.isPending}
                  onClick={() =>
                    setState.mutate({
                      number: pull.number,
                      state: pull.state === "open" ? "closed" : "open",
                    })
                  }
                >
                  {pull.state === "open" ? "PR 닫기" : "다시 열기"}
                </Button>
              ) : null}
            </div>
            <ul className="github-detail__stats">
              <li>커밋 {pull.commits ?? 0}</li>
              <li>변경 파일 {pull.changedFiles ?? 0}</li>
              <li className="github-diff--add">+{pull.additions ?? 0}</li>
              <li className="github-diff--del">−{pull.deletions ?? 0}</li>
            </ul>
          </header>

          <CommentCard
            user={pull.user}
            createdAt={pull.createdAt}
            bodyHtml={pull.bodyHtml}
            isBody
          />

          {pull.state === "open" && canWrite ? (
            <MergeBox pull={pull} onMerge={() => setMergeTarget(pull)} />
          ) : null}

          <CommentThread
            repo={repo}
            number={pull.number}
            canComment={!detail.archived}
          />

          <MergePullDialog
            repo={repo}
            pull={mergeTarget}
            onClose={() => setMergeTarget(null)}
          />
        </>
      ) : null}
    </div>
  );
}

function MergeBox({ pull, onMerge }: { pull: GitHubPull; onMerge: () => void }) {
  const status = mergeStatus(pull);
  const blocked = pull.draft || pull.mergeable === false;
  return (
    <section className={`github-merge-box github-merge-box--${status.tone}`}>
      <p>{status.text}</p>
      <Button disabled={blocked} onClick={onMerge}>
        Merge pull request
      </Button>
    </section>
  );
}
