import { RunStatusBadge } from "@/components/github/atoms/RunStatusBadge";
import { formatDuration, formatGitHubTime } from "@/lib/github";
import type { GitHubWorkflowRun } from "@/types/github";

interface RunListProps<T extends GitHubWorkflowRun> {
  runs: T[];
  emptyText: string;
  onOpen: (run: T) => void;
}

export function RunList<T extends GitHubWorkflowRun>({
  runs,
  emptyText,
  onOpen,
}: RunListProps<T>) {
  if (runs.length === 0) {
    return <p className="github-list__empty">{emptyText}</p>;
  }

  return (
    <ul className="github-list" role="list">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            className="github-list__row github-run-row"
            onClick={() => onOpen(run)}
          >
            <RunStatusBadge status={run.status} conclusion={run.conclusion} />
            <span className="github-list__main">
              <span className="github-list__title">
                {run.displayTitle || run.name}
              </span>
              <span className="github-list__sub">
                <strong>{run.name}</strong> #{run.runNumber}: {run.event} ·{" "}
                {run.actor.login}
                {run.headBranch ? (
                  <>
                    {" "}
                    · <code className="github-ref">{run.headBranch}</code>
                  </>
                ) : null}
              </span>
            </span>
            <span className="github-run-row__time">
              <span>{formatGitHubTime(run.createdAt)}</span>
              <span>
                {formatDuration(
                  run.runStartedAt ?? run.createdAt,
                  run.status === "completed" ? run.updatedAt : null,
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
