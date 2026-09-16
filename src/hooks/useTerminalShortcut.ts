import { useEffect } from "react";
import { useTerminalStore } from "@/stores/terminalStore";

/** Ctrl/Cmd + ` 로 터미널 패널을 토글합니다. */
export function useTerminalShortcut() {
  const toggle = useTerminalStore((state) => state.toggle);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (event.key !== "`" && event.code !== "Backquote") {
        return;
      }

      event.preventDefault();
      toggle();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);
}
