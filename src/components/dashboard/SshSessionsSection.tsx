import type { RemoteSshSession } from "@/types/sshSession";
import "./css/dashboard.css";

interface SshSessionsSectionProps {
  sessions: RemoteSshSession[];
  loading: boolean;
  error: string | null;
}

function formatIdle(idle: string): string {
  if (idle === "." || idle === "—") {
    return "활성";
  }
  if (idle === "old") {
    return "오래됨";
  }
  return idle;
}

export function SshSessionsSection({
  sessions,
  loading,
  error,
}: SshSessionsSectionProps) {
  if (loading && sessions.length === 0) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <p
        className="dashboard-section__status dashboard-section__status--error"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <ul className="dashboard-ssh-list" aria-label="SSH 세션">
        <li className="dashboard-ssh dashboard-ssh--placeholder">
          <span className="dashboard-ssh__icon" aria-hidden>
            ⌘
          </span>
          <div className="dashboard-ssh__body">
            <div className="dashboard-ssh__name">원격 로그인 세션 없음</div>
            <div className="dashboard-ssh__detail">
              who 기준 로그인 사용자가 없습니다
            </div>
          </div>
          <span className="dashboard-ssh__badge">—</span>
        </li>
      </ul>
    );
  }

  return (
    <ul className="dashboard-ssh-list" aria-label="SSH 세션">
      {error ? (
        <li className="dashboard-section__status dashboard-section__status--error">
          {error}
        </li>
      ) : null}
      {sessions.map((session) => (
        <li
          key={`${session.user}-${session.tty}-${session.from}-${session.loginAt}`}
          className="dashboard-ssh"
        >
          <span className="dashboard-ssh__icon" aria-hidden>
            ⌘
          </span>
          <div className="dashboard-ssh__body">
            <div className="dashboard-ssh__name">
              {session.user} · {session.tty}
            </div>
            <div className="dashboard-ssh__detail">
              {session.from} · {session.loginAt}
            </div>
          </div>
          <span className="dashboard-ssh__badge">
            {formatIdle(session.idle)}
          </span>
        </li>
      ))}
    </ul>
  );
}
