import { useCallback } from "react";
import { IconButton } from "@/components/common/IconButton";
import { PlusIcon } from "@/components/icons/ToolbarIcons";
import {
  activateSshSession,
  useSshLogin,
} from "@/hooks/useSshLogin";
import { useSshSessionStore } from "@/stores/sshSessionStore";
import "./css/session-tab-bar.css";

export function SessionTabBar() {
  const sessions = useSshSessionStore((state) => state.sessions);
  const activeSessionId = useSshSessionStore((state) => state.activeSessionId);
  const { beginAddSession, closeSession } = useSshLogin();

  const handleSelect = useCallback(async (sessionId: string) => {
    if (sessionId === useSshSessionStore.getState().activeSessionId) {
      return;
    }
    try {
      await activateSshSession(sessionId);
    } catch {
      // Keep current UI if backend switch fails.
    }
  }, []);

  if (sessions.length < 2) {
    return null;
  }

  return (
    <div className="session-tab-bar" role="tablist" aria-label="SSH 세션">
      <div className="session-tab-bar__list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={[
                "session-tab-bar__item",
                isActive ? "session-tab-bar__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="session-tab-bar__button"
                onClick={() => void handleSelect(session.id)}
              >
                {session.title}
              </button>
              <button
                type="button"
                className="session-tab-bar__close"
                aria-label={`${session.title} 닫기`}
                onClick={() => void closeSession(session.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <IconButton
        tone="neutral"
        tooltip="세션 추가"
        tooltipPosition="bottom"
        aria-label="세션 추가"
        className="session-tab-bar__add"
        onClick={beginAddSession}
      >
        <PlusIcon />
      </IconButton>
    </div>
  );
}
