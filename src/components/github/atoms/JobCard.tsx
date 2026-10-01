import { useState } from "react";
import { ChevronRightIcon, ExternalLinkIcon } from "@/components/icons/GitHubIcons";
import { JobLogPanel } from "@/components/github/atoms/JobLogPanel";
import { RunStatusBadge } from "@/components/github/atoms/RunStatusBadge";
import { formatDuration } from "@/lib/github";
import type { GitHubJob } from "@/types/github";

type JobPanel = "steps" | "logs" | null;

export function JobCard({ repo, job }: { repo: string; job: GitHubJob }) {
  const [panel, setPanel] = useState<JobPanel>(null);
  const completed = job.status === "completed";
  const toggle = (next: Exclude<JobPanel, null>) =>
    setPanel((current) => (current === next ? null : next));

  return (
    <li className="github-job">
      <div className="github-job__head">
        <button
          type="button"
          className={`github-job__toggle${panel === "steps" ? " is-open" : ""}`}
          aria-expanded={panel === "steps"}
          onClick={() => toggle("steps")}
        >
          <ChevronRightIcon />
          <RunStatusBadge status={job.status} conclusion={job.conclusion} />
          <span className="github-job__name">{job.name}</span>
        </button>
        <span className="github-job__duration">
          {formatDuration(job.startedAt, completed ? job.completedAt : null)}
        </span>
        <button
          type="button"
          className={`github-job__log-btn${panel === "logs" ? " is-active" : ""}`}
          disabled={!completed}
          title={completed ? undefined : "job이 끝난 뒤에 로그를 볼 수 있습니다."}
          onClick={() => toggle("logs")}
        >
          로그
        </button>
        {job.htmlUrl ? (
          <a
            className="github-job__link"
            href={job.htmlUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub에서 보기"
            title="GitHub에서 보기"
          >
            <ExternalLinkIcon />
          </a>
        ) : null}
      </div>

      {panel === "steps" ? (
        job.steps.length === 0 ? (
          <p className="github-job__empty">표시할 step이 없습니다.</p>
        ) : (
          <ol className="github-job__steps">
            {job.steps.map((step) => (
              <li key={step.number} className="github-job__step">
                <RunStatusBadge status={step.status} conclusion={step.conclusion} />
                <span className="github-job__step-name">{step.name}</span>
                <span className="github-job__duration">
                  {formatDuration(
                    step.startedAt,
                    step.status === "completed" ? step.completedAt : null,
                  )}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : null}

      {panel === "logs" ? <JobLogPanel repo={repo} jobId={job.id} /> : null}
    </li>
  );
}
