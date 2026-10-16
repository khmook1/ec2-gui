import type { WeeklyReport } from "@/types/github";

interface ReportHistoryListProps {
  reports: WeeklyReport[];
  selectedWeekKey: string | null;
  currentWeekKey: string | null;
  onSelect: (weekKey: string) => void;
}

export function ReportHistoryList({
  reports,
  selectedWeekKey,
  currentWeekKey,
  onSelect,
}: ReportHistoryListProps) {
  if (reports.length === 0) {
    return <p className="github-report__empty">아직 생성한 리포트가 없습니다.</p>;
  }

  return (
    <ul className="github-report__history">
      {reports.map((report) => (
        <li key={report.weekKey}>
          <button
            type="button"
            className={[
              "github-report__history-item",
              report.weekKey === selectedWeekKey
                ? "github-report__history-item--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(report.weekKey)}
          >
            <span className="github-report__history-week">
              {report.weekKey}
              {report.weekKey === currentWeekKey ? (
                <span className="github-report__badge">이번 주</span>
              ) : null}
            </span>
            <span className="github-report__history-meta">
              {report.periodStart} ~ {report.periodEnd}
            </span>
            <span className="github-report__history-meta">
              커밋 {report.commitCount}개 · 저장소 {report.repos.length}개
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
