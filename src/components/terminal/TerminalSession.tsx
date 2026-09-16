import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import {
  listenSshTerminalClosed,
  listenSshTerminalData,
  resizeSshShell,
  writeSshShell,
} from "@/services/tauri";
import "@xterm/xterm/css/xterm.css";

interface TerminalSessionProps {
  shellId: string;
  active: boolean;
}

export function TerminalSession({ shellId, active }: TerminalSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
      },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    const dataDisposable = term.onData((data) => {
      void writeSshShell(shellId, data);
    });

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    void (async () => {
      const unlistenData = await listenSshTerminalData((payload) => {
        if (payload.shellId !== shellId) {
          return;
        }
        term.write(payload.data);
      });
      const unlistenClosed = await listenSshTerminalClosed((payload) => {
        if (payload.shellId !== shellId) {
          return;
        }
        term.writeln("\r\n\x1b[90m[세션이 종료되었습니다]\x1b[0m");
      });

      if (cancelled) {
        unlistenData();
        unlistenClosed();
        return;
      }

      unlisteners.push(unlistenData, unlistenClosed);
    })();

    const resizeObserver = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) {
        return;
      }
      try {
        fitRef.current.fit();
        const { cols, rows } = termRef.current;
        void resizeSshShell(shellId, cols, rows);
      } catch {
        // Ignore fit errors while hidden.
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      dataDisposable.dispose();
      resizeObserver.disconnect();
      for (const unlisten of unlisteners) {
        unlisten();
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [shellId]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        const term = termRef.current;
        if (term) {
          void resizeSshShell(shellId, term.cols, term.rows);
          term.focus();
        }
      } catch {
        // Ignore fit errors while panel animates open.
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [active, shellId]);

  return (
    <div
      className={[
        "terminal-session",
        active ? "terminal-session--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      hidden={!active}
      aria-hidden={!active}
    >
      <div ref={containerRef} className="terminal-session__xterm" />
    </div>
  );
}
