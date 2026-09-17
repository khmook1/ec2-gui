import { useEffect, useRef, useState } from "react";
import type { CachedLoginHistoryEntry } from "@/lib/loginCache";
import "./css/login-history.css";

interface LoginHistoryPanelProps {
  entries: CachedLoginHistoryEntry[];
  disabled?: boolean;
  onSelect: (entry: CachedLoginHistoryEntry) => void;
  onRemove: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
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

function HistoryMetaChips({
  entry,
  showHost,
}: {
  entry: CachedLoginHistoryEntry;
  showHost: boolean;
}) {
  const authLabel = entry.authMethod === "pem" ? "PEM" : "비밀번호";
  const chips = [
    showHost ? { key: "host", label: entry.host, tone: "host" as const } : null,
    { key: "user", label: entry.username, tone: "user" as const },
    { key: "port", label: `:${entry.port}`, tone: "port" as const },
    { key: "auth", label: authLabel, tone: "auth" as const },
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null);

  return (
    <span className="login-history__chips" aria-label="접속 정보">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={`login-history__chip login-history__chip--${chip.tone}`}
        >
          {chip.label}
        </span>
      ))}
    </span>
  );
}

export function LoginHistoryPanel({
  entries,
  disabled = false,
  onSelect,
  onRemove,
  onUpdateMemo,
}: LoginHistoryPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftMemo, setDraftMemo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  if (entries.length === 0) {
    return null;
  }

  function startEdit(entry: CachedLoginHistoryEntry) {
    if (disabled) {
      return;
    }
    skipCommitRef.current = false;
    setEditingId(entry.id);
    setDraftMemo(entry.memo);
  }

  function commitEdit(id: string) {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    onUpdateMemo(id, draftMemo);
    setEditingId(null);
  }

  function cancelEdit() {
    skipCommitRef.current = true;
    setEditingId(null);
  }

  return (
    <aside className="login-history" aria-label="이전 접속 기록">
      <p className="login-history__title">이전 접속</p>
      <ul className="login-history__list">
        {entries.map((entry, index) => {
          const title = entry.memo.trim() || entry.host;
          const isEditing = editingId === entry.id;
          const showHostChip = Boolean(entry.memo.trim()) || isEditing;

          return (
            <li
              key={entry.id}
              className="login-history__item"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {isEditing ? (
                <div className="login-history__card login-history__card--editing">
                  <input
                    ref={inputRef}
                    type="text"
                    className="login-history__memo-input"
                    value={draftMemo}
                    placeholder="메모 (타이틀)"
                    maxLength={40}
                    disabled={disabled}
                    onChange={(event) => setDraftMemo(event.target.value)}
                    onBlur={() => commitEdit(entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitEdit(entry.id);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                  />
                  <HistoryMetaChips entry={entry} showHost={showHostChip} />
                </div>
              ) : (
                <button
                  type="button"
                  className="login-history__card"
                  disabled={disabled}
                  onClick={() => onSelect(entry)}
                >
                  <span className="login-history__host">{title}</span>
                  <HistoryMetaChips entry={entry} showHost={showHostChip} />
                  <span className="login-history__time">
                    {formatRelativeTime(entry.savedAt)}
                  </span>
                </button>
              )}
              {!isEditing ? (
                <button
                  type="button"
                  className="login-history__memo-edit"
                  aria-label={`${title} 메모 편집`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    startEdit(entry);
                  }}
                >
                  메모
                </button>
              ) : null}
              <button
                type="button"
                className="login-history__dismiss"
                aria-label={`${title} 기록 삭제`}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isEditing) {
                    cancelEdit();
                  }
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
