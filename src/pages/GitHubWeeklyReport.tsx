import { useState } from "react";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { AsyncDataLoader } from "@/components/common/AsyncDataLoader";
import { Button } from "@/components/common/Button";
import { IconButton } from "@/components/common/IconButton";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { PageToolbar } from "@/components/common/PageToolbar";
import { CommitList } from "@/components/github/atoms/CommitList";
import { ReportHistoryList } from "@/components/github/atoms/ReportHistoryList";
import { ReportView } from "@/components/github/atoms/ReportView";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import {
  useCancelAiChatMutation,
  useGenerateWeeklyReportMutation,
  useRecentCommitsQuery,
  useWeeklyReportStatusQuery,
  useWeeklyReportsQuery,
} from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import { AI_CHAT_CANCELLED } from "@/services/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import "@/components/github/css/github.css";
import "@/components/github/css/github-repo.css";
import "@/components/github/css/github-report.css";

/** 사이드바에서 "최근 7일 커밋" 미리보기를 가리키는 선택 키 */
const RECENT_KEY = "__recent__";

export function GitHubWeeklyReportPage() {
  const ai = useSettingsStore((state) => state.ai);
  const statusQuery = useWeeklyReportStatusQuery();
  const reportsQuery = useWeeklyReportsQuery();
  const generateMutation = useGenerateWeeklyReportMutation();
  const cancelMutation = useCancelAiChatMutation();
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamStatus, setStreamStatus] = useState<string | null>(null);

  const status = statusQuery.data ?? null;
  const reports = reportsQuery.data ?? [];
  const generating = generateMutation.isPending;
  const alreadyGenerated = status?.generated ?? false;
  const showRecent =
    status != null &&
    (selectedWeekKey === RECENT_KEY || (selectedWeekKey == null && !alreadyGenerated));
  const selected = showRecent
    ? null
    : (reports.find((report) => report.weekKey === selectedWeekKey) ?? reports[0] ?? null);
  const recentQuery = useRecentCommitsQuery(showRecent);
  const generateErrorMessage = generateMutation.error
    ? githubErrorMessage(generateMutation.error, "리포트를 생성하지 못했습니다.")
    : null;
  const generateError =
    generateErrorMessage === AI_CHAT_CANCELLED ? null : generateErrorMessage;

  function handleGenerate() {
    if (!ai.provider) return;
    setStreamText("");
    setStreamStatus(null);
    generateMutation.mutate(
      {
        connection: { provider: ai.provider, binaryPath: ai.binaryPath },
        onEvent: (event) => {
          switch (event.type) {
            case "delta":
              setStreamText((text) => text + event.text);
              break;
            case "status":
              setStreamStatus(event.text);
              break;
            case "reset":
              setStreamText("");
              break;
          }
        },
      },
      {
        onSuccess: (report) => setSelectedWeekKey(report.weekKey),
        onSettled: () => {
          setStreamText("");
          setStreamStatus(null);
        },
      },
    );
  }

  const hint = !ai.provider
    ? "AI 설정에서 Claude 또는 Codex를 먼저 연결해 주세요."
    : alreadyGenerated
      ? `이번 주(${status?.weekKey}) 리포트가 있습니다. 다시 생성하면 최신 커밋으로 덮어씁니다.`
      : "최근 7일간 내 커밋과 코드 변경 내용을 AI가 회의 보고용으로 상세히 정리합니다.";

  return (
    <section className="explorer github-page">
      <PageToolbar
        actions={
          <>
            {generating ? (
              <Button variant="ghost" onClick={() => cancelMutation.mutate()}>
                취소
              </Button>
            ) : null}
            <Button disabled={!ai.provider || generating} onClick={handleGenerate}>
              {generating ? "생성 중…" : alreadyGenerated ? "다시 생성" : "리포트 생성"}
            </Button>
          </>
        }
        bodyClassName="github-page__toolbar"
      >
        <p className="page-toolbar__hint">{hint}</p>
      </PageToolbar>

      {generateError ? (
        <p className="explorer-error" role="alert">
          {generateError}
        </p>
      ) : null}
      {statusQuery.error || reportsQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(
            statusQuery.error ?? reportsQuery.error,
            "리포트 정보를 불러오지 못했습니다.",
          )}
        </p>
      ) : null}

      <AsyncDataLoader
        isLoading={reportsQuery.isLoading}
        hasData={reportsQuery.data != null}
        message="리포트 목록을 가져옵니다"
      >
        <div className="github-report">
          <aside className="github-report__sidebar">
            {status ? (
              <button
                type="button"
                className={[
                  "github-report__history-item",
                  "github-report__history-item--pinned",
                  showRecent ? "github-report__history-item--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelectedWeekKey(RECENT_KEY)}
              >
                <span className="github-report__history-week">최근 7일 커밋</span>
                <span className="github-report__history-meta">
                  {status.weekKey} · 생성 전 미리보기
                </span>
              </button>
            ) : null}
            <p className="github-report__sidebar-label">리포트 기록</p>
            <ReportHistoryList
              reports={reports}
              selectedWeekKey={selected?.weekKey ?? null}
              currentWeekKey={status?.weekKey ?? null}
              onSelect={setSelectedWeekKey}
            />
          </aside>
          <div className="github-report__main">
            {generating ? (
              <article className="github-report__view">
                <div className="github-report__progress" role="status">
                  <span className="github-report__spinner" aria-hidden />
                  <span>{streamStatus ?? "준비 중…"}</span>
                </div>
                {streamText ? (
                  <div className="github-report__paper">
                    <AiMarkdown content={streamText} tone="theme" typing />
                  </div>
                ) : null}
              </article>
            ) : selected ? (
              <ReportView report={selected} />
            ) : showRecent ? (
              <RecentCommitsPreview query={recentQuery} />
            ) : (
              <p className="github-report__empty">
                리포트 생성 버튼을 누르면 이번 주 업무 보고서를 만듭니다.
              </p>
            )}
          </div>
        </div>
      </AsyncDataLoader>
    </section>
  );
}

function RecentCommitsPreview({
  query,
}: {
  query: ReturnType<typeof useRecentCommitsQuery>;
}) {
  if (query.error) {
    return (
      <p className="explorer-error" role="alert">
        {githubErrorMessage(query.error, "커밋 목록을 불러오지 못했습니다.")}
      </p>
    );
  }
  if (!query.data) {
    return <LoadingIndicator message="최근 7일 커밋을 가져옵니다" />;
  }
  const { periodStart, periodEnd, commits } = query.data;
  const repoCount = new Set(commits.map((commit) => commit.repo)).size;

  return (
    <article className="github-report__view">
      <header className="github-report__hero">
        <div className="github-report__hero-top">
          <div className="github-report__hero-title">
            <span className="github-report__eyebrow">최근 7일 커밋 · 리포트 생성 전 미리보기</span>
            <h2>
              {periodStart} ~ {periodEnd}
            </h2>
          </div>
          <IconButton
            tone="success"
            tooltip="새로고침"
            aria-label="새로고침"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshIcon />
          </IconButton>
        </div>
        <dl className="github-report__stats">
          <div className="github-report__stat">
            <dt>커밋</dt>
            <dd>{commits.length}</dd>
          </div>
          <div className="github-report__stat">
            <dt>저장소</dt>
            <dd>{repoCount}</dd>
          </div>
        </dl>
      </header>
      <CommitList commits={commits} />
    </article>
  );
}
