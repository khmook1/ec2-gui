import { Button } from "@/components/common/Button";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { ArrowLeftIcon } from "@/components/icons/GitHubIcons";
import { CommentCard, CommentThread } from "@/components/github/atoms/CommentThread";
import { IssueLabels } from "@/components/github/atoms/IssueLabels";
import { StateBadge } from "@/components/github/atoms/StateBadge";
import {
  useGitHubIssueQuery,
  useGitHubViewerQuery,
  useSetGitHubIssueStateMutation,
} from "@/hooks/query";
import { formatGitHubTime, githubErrorMessage } from "@/lib/github";
import type { GitHubRepoDetail } from "@/types/github";

interface IssueDetailProps {
  detail: GitHubRepoDetail;
  number: number;
  onBack: () => void;
}

export function IssueDetail({ detail, number, onBack }: IssueDetailProps) {
  const repo = detail.fullName;
  const issueQuery = useGitHubIssueQuery(repo, number);
  const viewerQuery = useGitHubViewerQuery();
  const setState = useSetGitHubIssueStateMutation(repo);
  const issue = issueQuery.data;

  const { permissions } = detail;
  const isAuthor = issue != null && viewerQuery.data?.login === issue.user.login;
  const canChangeState =
    !detail.archived &&
    (permissions.triage || permissions.push || permissions.admin || isAuthor);

  return (
    <div className="github-detail">
      <button type="button" className="github-back" onClick={onBack}>
        <ArrowLeftIcon />
        이슈 목록
      </button>

      {issueQuery.isLoading ? (
        <LoadingIndicator message="이슈를 불러오는 중" />
      ) : issueQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(issueQuery.error, "이슈를 불러오지 못했습니다.")}
        </p>
      ) : issue ? (
        <>
          <header className="github-detail__header">
            <h2 className="github-detail__title">
              {issue.title}
              <span className="github-detail__number">#{issue.number}</span>
            </h2>
            <div className="github-detail__meta">
              <StateBadge state={issue.state} size="lg" />
              <span>
                <strong>{issue.user.login}</strong> 님이{" "}
                {formatGitHubTime(issue.createdAt)}에 작성 · 댓글 {issue.comments}개
              </span>
              <IssueLabels labels={issue.labels} />
              {canChangeState ? (
                <Button
                  variant="ghost"
                  className="github-detail__action"
                  disabled={setState.isPending}
                  onClick={() =>
                    setState.mutate({
                      number: issue.number,
                      state: issue.state === "open" ? "closed" : "open",
                    })
                  }
                >
                  {issue.state === "open" ? "이슈 닫기" : "다시 열기"}
                </Button>
              ) : null}
            </div>
          </header>

          <CommentCard
            user={issue.user}
            createdAt={issue.createdAt}
            bodyHtml={issue.bodyHtml}
            isBody
          />
          <CommentThread
            repo={repo}
            number={issue.number}
            canComment={!detail.archived}
          />
        </>
      ) : null}
    </div>
  );
}
