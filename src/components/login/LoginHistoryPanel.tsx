import type { CachedLoginHistoryEntry } from "@/lib/loginCache";

interface LoginHistoryPanelProps {
  entries: CachedLoginHistoryEntry[];
  disabled?: boolean;
  onSelect: (entry: CachedLoginHistoryEntry) => void;
  onRemove: (id: string) => void;
}

function formatRelativeTime(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return "방금";
  }
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }

  return "어제";
}

export function LoginHistoryPanel({
  entries,
  disabled = false,
  onSelect,
  onRemove,
}: LoginHistoryPanelProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <aside className="login-history" aria-label="이전 접속 기록">
      <p className="login-history__title">이전 접속</p>
      <ul className="login-history__list">
        {entries.map((entry, index) => {
          const authLabel = entry.authMethod === "pem" ? "PEM 키" : "비밀번호";

          return (
            <li
              key={entry.id}
              className="login-history__item"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <button
                type="button"
                className="login-history__card"
                disabled={disabled}
                onClick={() => onSelect(entry)}
              >
                <span className="login-history__host">{entry.host}</span>
                <span className="login-history__meta">
                  {entry.username} · {entry.port} · {authLabel}
                </span>
                <span className="login-history__time">
                  {formatRelativeTime(entry.savedAt)}
                </span>
              </button>
              <button
                type="button"
                className="login-history__dismiss"
                aria-label={`${entry.host} 기록 삭제`}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(entry.id);
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
