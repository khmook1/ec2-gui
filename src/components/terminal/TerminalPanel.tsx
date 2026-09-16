import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { IconButton } from "@/components/common/IconButton";
import { TerminalSession } from "@/components/terminal/TerminalSession";
import { TerminalTabs } from "@/components/terminal/TerminalTabs";
import { openSshShell } from "@/services/tauri";
import {
  TERMINAL_MIN_HEIGHT,
  clampTerminalHeight,
  useTerminalStore,
} from "@/stores/terminalStore";

/** Strict Mode 이중 effect 로 인한 자동 세션 중복 생성 방지 */
let autoCreateInFlight = false;

export function TerminalPanel() {
  const isOpen = useTerminalStore((state) => state.isOpen);
  const height = useTerminalStore((state) => state.height);
  const sessions = useTerminalStore((state) => state.sessions);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const setOpen = useTerminalStore((state) => state.setOpen);
  const setHeight = useTerminalStore((state) => state.setHeight);
  const addSession = useTerminalStore((state) => state.addSession);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(height);
  const creatingRef = useRef(false);
  const resizingRef = useRef(false);

  const createSession = useCallback(async () => {
    if (creatingRef.current) {
      return;
    }
    creatingRef.current = true;
    try {
      const cols = Math.max(80, Math.floor(window.innerWidth / 8));
      const rows = Math.max(24, Math.floor(height / 18));
      const shellId = await openSshShell(cols, rows);
      addSession(shellId);
    } catch (error) {
      console.error("터미널 세션을 열지 못했습니다.", error);
    } finally {
      creatingRef.current = false;
    }
  }, [addSession, height]);

  useEffect(() => {
    if (!isOpen || sessions.length > 0 || autoCreateInFlight) {
      return;
    }

    autoCreateInFlight = true;
    void createSession().finally(() => {
      autoCreateInFlight = false;
    });
  }, [createSession, isOpen, sessions.length]);

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
            key={session.id}
            shellId={session.id}
            active={session.id === activeSessionId}
          />
        ))}
        {sessions.length === 0 ? (
          <div className="terminal-panel__empty" role="status">
            터미널을 여는 중…
          </div>
        ) : null}
      </div>
    </section>
  );
}
