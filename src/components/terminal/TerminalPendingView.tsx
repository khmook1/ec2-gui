import { useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import type { TerminalPending } from "@/stores/terminalStore";
import "./css/terminal-pending.css";

const SLOW_HINT_DELAY_MS = 3000;

interface TerminalPendingViewProps {
  pending: TerminalPending;
  onRetry: () => void;
  onDismiss: () => void;
}

export function TerminalPendingView({
  pending,
  onRetry,
  onDismiss,
}: TerminalPendingViewProps) {
  const opening = pending.status === "opening";
  const [slowToken, setSlowToken] = useState<number | null>(null);
  const slow = opening && slowToken === pending.token;

  useEffect(() => {
    if (!opening) {
      return;
    }
    const timer = window.setTimeout(
      () => setSlowToken(pending.token),
      SLOW_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [opening, pending.token]);

  if (opening) {
    return (
      <div className="terminal-pending">
        <LoadingIndicator
          size={56}
          message="터미널 연결 중…"
          className="terminal-pending__loading"
        />
        {slow ? (
          <p className="terminal-pending__hint">
            서버 응답을 기다리는 중입니다. 다른 작업은 계속하셔도 됩니다.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="terminal-pending terminal-pending--error" role="alert">
      <p className="terminal-pending__title">터미널을 열지 못했습니다</p>
      {pending.message ? (
        <p className="terminal-pending__message">{pending.message}</p>
      ) : null}
      <div className="terminal-pending__actions">
        <button
          type="button"
          className="terminal-pending__btn terminal-pending__btn--primary"
          onClick={onRetry}
        >
          <RefreshIcon />
          다시 시도
        </button>
        <button
          type="button"
          className="terminal-pending__btn"
          onClick={onDismiss}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
