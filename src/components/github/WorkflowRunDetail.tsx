import { Button } from "@/components/common/Button";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { ArrowLeftIcon, ExternalLinkIcon } from "@/components/icons/GitHubIcons";
import { JobCard } from "@/components/github/atoms/JobCard";
import { RunStatusBadge } from "@/components/github/atoms/RunStatusBadge";
import {
  useCancelGitHubWorkflowRunMutation,
  useGitHubRunJobsQuery,
  useGitHubWorkflowRunQuery,
  useRerunGitHubWorkflowRunMutation,
} from "@/hooks/query";
import { formatDuration, formatGitHubTime, githubErrorMessage } from "@/lib/github";
import type { GitHubRepoDetail } from "@/types/github";

interface WorkflowRunDetailProps {
  detail: GitHubRepoDetail;
  runId: number;
  onBack: () => void;
}

const FAILED_CONCLUSIONS = new Set(["failure", "timed_out", "cancelled", "startup_failure"]);

export function WorkflowRunDetail({ detail, runId, onBack }: WorkflowRunDetailProps) {
  const repo = detail.fullName;
  const runQuery = useGitHubWorkflowRunQuery(repo, runId);
  const jobsQuery = useGitHubRunJobsQuery(repo, runId);
  const rerun = useRerunGitHubWorkflowRunMutation(repo);
  const cancel = useCancelGitHubWorkflowRunMutation(repo);
  const run = runQuery.data;

  const { permissions } = detail;
  const canWrite = !detail.archived && (permissions.push || permissions.admin);
  const busy = rerun.isPending || cancel.isPending;

  return (
    <div className="github-detail">
      <button type="button" className="github-back" onClick={onBack}>
        <ArrowLeftIcon />
        실행 목록
      </button>

      {runQuery.isLoading ? (
        <LoadingIndicator message="실행 정보를 불러오는 중" />
      ) : runQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(runQuery.error, "실행 정보를 불러오지 못했습니다.")}
        </p>
      ) : run ? (
        <>
          <header className="github-detail__header">
            <h2 className="github-detail__title">
              {run.displayTitle || run.name}
              <span className="github-detail__number">#{run.runNumber}</span>
            </h2>
            <div className="github-detail__meta">
              <RunStatusBadge status={run.status} conclusion={run.conclusion} showLabel />
              <span>
                <strong>{run.name}</strong> · {run.event} · {run.actor.login}
                {run.headBranch ? (
                  <>
                    {" "}
                    · <code className="github-ref">{run.headBranch}</code>
                  </>
                ) : null}{" "}
                · <code className="github-ref">{run.headSha.slice(0, 7)}</code>
              </span>
              <div className="github-run-actions">
                {canWrite && run.status !== "completed" ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => cancel.mutate(run.id)}
                  >
                    실행 취소
                  </Button>
                ) : null}
                {canWrite && run.status === "completed" ? (
                  <>
                    {FAILED_CONCLUSIONS.has(run.conclusion ?? "") ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => rerun.mutate({ runId: run.id, failedOnly: true })}
                      >
                        실패한 job 다시 실행
                      </Button>
                    ) : null}
                    <Button
                      disabled={busy}
                      onClick={() => rerun.mutate({ runId: run.id, failedOnly: false })}
                    >
                      모두 다시 실행
                    </Button>
                  </>
                ) : null}
                <a
                  className="github-run-actions__link"
                  href={run.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLinkIcon />
                  GitHub
                </a>
              </div>
            </div>
            <ul className="github-detail__stats">
              <li>시작 {formatGitHubTime(run.runStartedAt ?? run.createdAt)}</li>
              <li>
                소요{" "}
                {formatDuration(
                  run.runStartedAt ?? run.createdAt,
                  run.status === "completed" ? run.updatedAt : null,
                )}
              </li>
              {run.runAttempt > 1 ? <li>시도 #{run.runAttempt}</li> : null}
            </ul>
          </header>

          <section className="github-jobs">
            <h3 className="github-jobs__title">Jobs</h3>
            {jobsQuery.isLoading ? (
              <LoadingIndicator message="job을 불러오는 중" />
            ) : jobsQuery.error ? (
              <p className="explorer-error" role="alert">
                {githubErrorMessage(jobsQuery.error, "job을 불러오지 못했습니다.")}
              </p>
            ) : jobsQuery.data && jobsQuery.data.length > 0 ? (
              <ul className="github-jobs__list" role="list">
                {jobsQuery.data.map((job) => (
                  <JobCard key={job.id} repo={repo} job={job} />
                ))}
              </ul>
            ) : (
              <p className="github-list__empty">아직 시작된 job이 없습니다.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
