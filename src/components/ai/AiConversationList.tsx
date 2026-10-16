import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useAiConversationsQuery,
  useDeleteAiConversationMutation,
} from "@/hooks/query";
import { getAiProviderLabel } from "@/types/settings";
import "./css/ai-speech-bubble.css";
import "./css/ai-conversation-list.css";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

interface AiConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  onNewConversation: () => void;
  onClose: () => void;
}

export function AiConversationList({
  activeId,
  onSelect,
  onDeleted,
  onNewConversation,
  onClose,
}: AiConversationListProps) {
  const { data: conversations = [], isLoading, error } = useAiConversationsQuery();
  const deleteMutation = useDeleteAiConversationMutation();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleDelete(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    deleteMutation.mutate(id, { onSuccess: () => onDeleted(id) });
  }

  return createPortal(
    <div className="ai-bubble ai-conversations" role="dialog" aria-label="AI 대화 목록">
      <button
        type="button"
        className="ai-bubble__close"
        aria-label="대화 목록 닫기"
        onClick={onClose}
      >
        ×
      </button>
      <p className="ai-conversations__title">대화 목록</p>

      <div className="ai-bubble__body">
        {isLoading ? <p className="ai-conversations__empty">불러오는 중…</p> : null}
        {error ? (
          <p className="ai-bubble__error">
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : null}
        {!isLoading && !error && conversations.length === 0 ? (
          <p className="ai-conversations__empty">저장된 대화가 없습니다.</p>
        ) : null}
        <ul className="ai-conversations__list">
          {conversations.map((item) => (
            <li
              key={item.id}
              className={[
                "ai-conversations__item",
                item.id === activeId ? "ai-conversations__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="ai-conversations__open"
                onClick={() => onSelect(item.id)}
              >
                <span className="ai-conversations__item-title">{item.title}</span>
                <span className="ai-conversations__item-meta">
                  {getAiProviderLabel(item.provider)} · 질문 {Math.ceil(item.messageCount / 2)}개 ·{" "}
                  {formatDate(item.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                className={[
                  "ai-conversations__delete",
                  confirmingId === item.id ? "ai-conversations__delete--confirm" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`${item.title} 대화 삭제`}
                disabled={deleteMutation.isPending}
                onClick={() => handleDelete(item.id)}
                onBlur={() => setConfirmingId((current) => (current === item.id ? null : current))}
              >
                {confirmingId === item.id ? "삭제 확인" : "삭제"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ai-bubble__footer">
        <span className="ai-bubble__note">
          {deleteMutation.error instanceof Error ? deleteMutation.error.message : null}
        </span>
        <div className="ai-bubble__actions">
          <button type="button" className="ai-bubble__action" onClick={onNewConversation}>
            새 대화
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
