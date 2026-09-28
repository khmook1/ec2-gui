import { useEffect } from "react";
import { useSshLogin } from "@/hooks/useSshLogin";
import { useSshSessionStore } from "@/stores/sshSessionStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.closest('[contenteditable="true"]') != null;
}

/** Ctrl/Cmd + T 로 SSH 세션을 추가합니다. (한글 ㅅ 키 포함: KeyT) */
export function useNewSshSessionShortcut() {
  const { beginAddSession } = useSshLogin();
  const hasSessions = useSshSessionStore((state) => state.sessions.length > 0);
  const isAddingSession = useSshSessionStore((state) => state.isAddingSession);

  useEffect(() => {
    if (!hasSessions || isAddingSession) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.code !== "KeyT") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]')
      ) {
        return;
      }

      event.preventDefault();
      beginAddSession();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beginAddSession, hasSessions, isAddingSession]);
}
