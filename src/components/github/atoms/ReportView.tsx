import { useEffect, useState } from "react";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { Button } from "@/components/common/Button";
import { CommitList } from "@/components/github/atoms/CommitList";
import { formatGitHubTime } from "@/lib/github";
import type { WeeklyReport } from "@/types/github";
import type { AiProvider } from "@/types/settings";

const COPIED_FEEDBACK_MS = 1500;
const PROVIDER_LABELS: Record<AiProvider, string> = {
  claude: "Claude",
  codex: "Codex",
};

type ReportTab = "report" | "commits";

export function ReportView({ report }: { report: WeeklyReport }) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<ReportTab>("report");
  const hasCommits = report.commits.length > 0;

  useEffect(() => {
    setTab("report");
  }, [report.weekKey]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(report.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const tabs: { value: ReportTab; label: string }[] = [
    { value: "report", label: "리포트" },
    { value: "commits", label: `커밋 ${report.commits.length}개` },
  ];

  return (
    <article className="github-report__view">
      <header className="github-report__hero">
        <div className="github-report__hero-top">
          <div className="github-report__hero-title">
            <span className="github-report__eyebrow">{report.weekKey} 주간 업무 보고</span>
            <h2>
              {report.periodStart} ~ {report.periodEnd}
            </h2>
          </div>
          <div className="github-report__view-actions">
            {hasCommits ? (
              <div className="github-segmented" role="tablist" aria-label="보기">
                {tabs.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={tab === option.value}
                    className={[
                      "github-segmented__item",
                      tab === option.value ? "github-segmented__item--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setTab(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <Button variant="ghost" onClick={() => void handleCopy()}>
              {copied ? "복사됨" : "마크다운 복사"}
            </Button>
          </div>
        </div>
        <dl className="github-report__stats">
          <div className="github-report__stat">
            <dt>커밋</dt>
            <dd>{report.commitCount}</dd>
          </div>
          <div className="github-report__stat">
            <dt>저장소</dt>
            <dd>{report.repos.length}</dd>
          </div>
          <div className="github-report__stat">
            <dt>생성</dt>
            <dd>{formatGitHubTime(report.createdAt)}</dd>
          </div>
          <div className="github-report__stat">
            <dt>AI</dt>
            <dd>{PROVIDER_LABELS[report.provider]}</dd>
          </div>
        </dl>
        {report.repos.length > 0 ? (
          <ul className="github-report__repos">
            {report.repos.map((repo) => (
              <li key={repo} className="github-report__repo">
                {repo}
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      {tab === "commits" && hasCommits ? (
        <CommitList commits={report.commits} />
      ) : (
        <div className="github-report__paper">
          <AiMarkdown content={report.content} tone="theme" />
        </div>
      )}
    </article>
  );
}
