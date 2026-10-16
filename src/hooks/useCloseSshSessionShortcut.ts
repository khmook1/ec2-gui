import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSshLogin } from "@/hooks/useSshLogin";
import { useSshSessionStore } from "@/stores/sshSessionStore";

/** Ctrl/Cmd+W 또는 창 닫기 요청 시, 여러 세션 중 현재 세션을 먼저 닫는다. */
export function useCloseSshSessionShortcut() {
  const { closeSession } = useSshLogin();
  const closeSessionRef = useRef(closeSession);
  const closingRef = useRef(false);
  closeSessionRef.current = closeSession;

  useEffect(() => {
    function closeActiveSession(): boolean {
      const { sessions, activeSessionId } = useSshSessionStore.getState();
      if (sessions.length < 2 || !activeSessionId) return false;

      if (!closingRef.current) {
        closingRef.current = true;
        void closeSessionRef.current(activeSessionId).then(
          () => {
            closingRef.current = false;
          },
          () => {
            closingRef.current = false;
          },
        );
      }
      return true;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "KeyW" || !(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey || event.repeat) return;
      if (!closeActiveSession()) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("keydown", onKeyDown, true);

    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      void getCurrentWindow()
        .onCloseRequested((event) => {
          if (closeActiveSession()) event.preventDefault();
        })
        .then((remove) => {
          if (disposed) remove();
          else unlisten = remove;
        })
        .catch((error: unknown) => {
          console.error("창 닫기 단축키 등록에 실패했습니다.", error);
        });
    }

    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
}
