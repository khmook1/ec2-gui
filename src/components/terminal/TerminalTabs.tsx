import { useCallback } from "react";
import { IconButton } from "@/components/common/IconButton";
import { PlusIcon } from "@/components/icons/ToolbarIcons";
import { closeSshShell } from "@/services/tauri";
import { useTerminalStore } from "@/stores/terminalStore";

interface TerminalTabsProps {
  onAddSession: () => void;
}

export function TerminalTabs({ onAddSession }: TerminalTabsProps) {
  const sessions = useTerminalStore((state) => state.sessions);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const setActiveSession = useTerminalStore((state) => state.setActiveSession);
  const removeSession = useTerminalStore((state) => state.removeSession);

  const handleClose = useCallback(
    async (sessionId: string) => {
      try {
        await closeSshShell(sessionId);
      } catch {
        // Local tab should close even if remote close fails.
      }
      removeSession(sessionId);
    },
    [removeSession],
  );

  return (
    <div className="terminal-tabs" role="tablist" aria-label="터미널 세션">
      <div className="terminal-tabs__list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={[
                "terminal-tabs__item",
                isActive ? "terminal-tabs__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="terminal-tabs__button"
                onClick={() => setActiveSession(session.id)}
              >
                {session.title}
              </button>
              <button
                type="button"
                className="terminal-tabs__close"
                aria-label={`${session.title} 닫기`}
                onClick={() => void handleClose(session.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <IconButton
        tone="neutral"
        tooltip="새 터미널"
        aria-label="새 터미널"
        className="terminal-tabs__add"
        onClick={onAddSession}
      >
        <PlusIcon />
      </IconButton>
    </div>
  );
}
