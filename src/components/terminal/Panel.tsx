import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { IconButton } from "@/components/common/IconButton";
import { TerminalPendingView } from "@/components/terminal/TerminalPendingView";
import { TerminalSession } from "@/components/terminal/TerminalSession";
import { TerminalTabs } from "@/components/terminal/TerminalTabs";
import { closeSshShell, openSshShell } from "@/services/tauri";
import {
  TERMINAL_MIN_HEIGHT,
  clampTerminalHeight,
  useTerminalStore,
} from "@/stores/terminalStore";
import "./css/terminal-panel.css";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "터미널 세션을 열지 못했습니다.";
}

export function TerminalPanel() {
  const isOpen = useTerminalStore((state) => state.isOpen);
  const height = useTerminalStore((state) => state.height);
  const sessions = useTerminalStore((state) => state.sessions);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const pending = useTerminalStore((state) => state.pending);
  const setOpen = useTerminalStore((state) => state.setOpen);
  const setHeight = useTerminalStore((state) => state.setHeight);
  const addSession = useTerminalStore((state) => state.addSession);
  const beginOpening = useTerminalStore((state) => state.beginOpening);
  const failOpening = useTerminalStore((state) => state.failOpening);
  const dismissPending = useTerminalStore((state) => state.dismissPending);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(height);
  const resizingRef = useRef(false);

  const createSession = useCallback(async () => {
    // 스토어를 직접 읽어 Strict Mode 이중 effect·연타로 인한 중복 생성을 막는다.
    if (useTerminalStore.getState().pending?.status === "opening") {
      return;
    }
    const token = beginOpening();
    try {
      const cols = Math.max(80, Math.floor(window.innerWidth / 8));
      const rows = Math.max(24, Math.floor(height / 18));
      const shellId = await openSshShell(cols, rows);
      if (useTerminalStore.getState().pending?.token !== token) {
        void closeSshShell(shellId).catch(() => {
          // 서버 전환 등으로 무효화된 요청의 셸 정리
        });
        return;
      }
      addSession(shellId);
    } catch (error) {
      failOpening(token, errorMessage(error));
    }
  }, [addSession, beginOpening, failOpening, height]);

  useEffect(() => {
    if (!isOpen || sessions.length > 0 || pending) {
      return;
    }
    void createSession();
  }, [createSession, isOpen, pending, sessions.length]);

  const stopResize = useCallback(() => {
    if (!resizingRef.current) {
      return;
    }
    resizingRef.current = false;
    document.body.classList.remove("terminal-panel-resizing");
  }, []);

  const handleResizePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      resizingRef.current = true;
      dragStartY.current = event.clientY;
      dragStartHeight.current = height;
      document.body.classList.add("terminal-panel-resizing");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [height],
  );

  const handleResizePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!resizingRef.current) {
        return;
      }
      event.preventDefault();
      const delta = dragStartY.current - event.clientY;
      setHeight(clampTerminalHeight(dragStartHeight.current + delta));
    },
    [setHeight],
  );

  const handleResizePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!resizingRef.current) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      stopResize();
    },
    [stopResize],
  );

  useEffect(() => {
    return () => {
      document.body.classList.remove("terminal-panel-resizing");
    };
  }, []);

  const hasSessions = sessions.length > 0;
  if (!isOpen && !hasSessions) {
    return null;
  }

  return (
    <section
      className={[
        "terminal-panel",
        isOpen ? "" : "terminal-panel--collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: isOpen ? height : 0 }}
      hidden={!isOpen}
      aria-hidden={!isOpen}
      aria-label="SSH 터미널"
    >
      <div
        className="terminal-panel__resize"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin={TERMINAL_MIN_HEIGHT}
        aria-valuenow={height}
        aria-label="터미널 높이 조절"
      />
      <div className="terminal-panel__header">
        <TerminalTabs onAddSession={() => void createSession()} />
        <IconButton
          variant="close"
          tone="neutral"
          tooltip="터미널 닫기"
          onClick={() => setOpen(false)}
        />
      </div>
      <div className="terminal-panel__body">
        {sessions.map((session) => (
          <TerminalSession
            key={session.key ?? session.id}
            shellId={session.id}
            active={session.id === activeSessionId}
          />
        ))}
        {pending && activeSessionId === null ? (
          <TerminalPendingView
            pending={pending}
            onRetry={() => void createSession()}
            onDismiss={dismissPending}
          />
        ) : null}
      </div>
    </section>
  );
}
