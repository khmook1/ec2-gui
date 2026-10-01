import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon, type ISearchOptions } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import {
  TerminalSearchBar,
  type TerminalSearchDirection,
  type TerminalSearchQuery,
  type TerminalSearchResults,
} from "@/components/terminal/TerminalSearchBar";
import {
  closeSshShell,
  listenSshTerminalClosed,
  listenSshTerminalData,
  openSshShell,
  resizeSshShell,
  writeSshShell,
} from "@/services/tauri";
import { useTerminalStore } from "@/stores/terminalStore";
import "./css/terminal-session.css";
import "@xterm/xterm/css/xterm.css";

interface TerminalSessionProps {
  shellId: string;
  active: boolean;
}

/** 배경색은 #RRGGBB 형식만 허용됨 */
const SEARCH_DECORATIONS: ISearchOptions["decorations"] = {
  matchBackground: "#515c6a",
  matchOverviewRuler: "#d4d4d4",
  activeMatchBackground: "#a8740a",
  activeMatchBorder: "#ffd33d",
  activeMatchColorOverviewRuler: "#ffd33d",
};

function isFindShortcut(event: KeyboardEvent): boolean {
  return (
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.key.toLowerCase() === "f"
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "재연결에 실패했습니다.";
}

export function TerminalSession({ shellId, active }: TerminalSessionProps) {
  const replaceSessionId = useTerminalStore((state) => state.replaceSessionId);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [initialQuery, setInitialQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<TerminalSearchResults | null>(null);
  const searchOpenRef = useRef(false);

  /** 재연결 시 xterm 은 유지하고 연결된 셸만 바꾸므로 현재 셸 ID 는 ref 로 추적 */
  const shellIdRef = useRef(shellId);
  const disconnectedRef = useRef(false);
  const reconnectingRef = useRef(false);
  /** 재연결 중 새 셸 ID 를 받기 전에 도착한 출력 (초기 프롬프트 유실 방지) */
  const pendingOutputRef = useRef(new Map<string, string>());
  const reconnectRef = useRef<() => void>(() => {});
  const [disconnected, setDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  /** 커맨드가 백그라운드 스레드에서 병렬 실행되므로 입력 순서가 섞이지 않게 한 번에 하나만 전송한다. */
  const writeBufferRef = useRef("");
  const writingRef = useRef(false);
  const fitFrameRef = useRef<number | null>(null);
  const resizingRef = useRef(false);
  const lastSentSizeRef = useRef<{
    shellId: string;
    cols: number;
    rows: number;
  } | null>(null);

  useEffect(() => {
    searchOpenRef.current = searchOpen;
  }, [searchOpen]);

  useEffect(() => {
    shellIdRef.current = shellId;
  }, [shellId]);

  const closeSearch = useCallback(() => {
    searchRef.current?.clearDecorations();
    setSearchOpen(false);
    setSearchResults(null);
    setInitialQuery("");
    termRef.current?.focus();
  }, []);

  const markDisconnected = useCallback(() => {
    writeBufferRef.current = "";
    if (disconnectedRef.current) {
      return;
    }
    disconnectedRef.current = true;
    setDisconnected(true);
    termRef.current?.writeln(
      "\r\n\x1b[90m[세션이 종료되었습니다 · Enter 또는 재연결 버튼으로 다시 연결]\x1b[0m",
    );
  }, []);

  const flushWrites = useCallback(async () => {
    if (writingRef.current) {
      return;
    }
    writingRef.current = true;
    try {
      while (writeBufferRef.current && !disconnectedRef.current) {
        const data = writeBufferRef.current;
        writeBufferRef.current = "";
        try {
          await writeSshShell(shellIdRef.current, data);
        } catch {
          markDisconnected();
        }
      }
    } finally {
      writingRef.current = false;
    }
  }, [markDisconnected]);

  const enqueueWrite = useCallback(
    (data: string) => {
      writeBufferRef.current += data;
      void flushWrites();
    },
    [flushWrites],
  );

  /** 진행 중인 요청이 끝나면 그 사이 바뀐 최신 크기만 이어서 보낸다. */
  const syncRemoteSize = useCallback(async () => {
    if (resizingRef.current) {
      return;
    }
    resizingRef.current = true;
    try {
      for (;;) {
        const term = termRef.current;
        if (!term || disconnectedRef.current) {
          return;
        }
        const target = {
          shellId: shellIdRef.current,
          cols: term.cols,
          rows: term.rows,
        };
        const last = lastSentSizeRef.current;
        if (
          last &&
          last.shellId === target.shellId &&
          last.cols === target.cols &&
          last.rows === target.rows
        ) {
          return;
        }
        lastSentSizeRef.current = target;
        try {
          await resizeSshShell(target.shellId, target.cols, target.rows);
        } catch {
          // 끊긴 셸은 입력/종료 이벤트로 감지
        }
      }
    } finally {
      resizingRef.current = false;
    }
  }, []);

  const scheduleFit = useCallback(() => {
    if (fitFrameRef.current !== null) {
      return;
    }
    fitFrameRef.current = requestAnimationFrame(() => {
      fitFrameRef.current = null;
      try {
        fitRef.current?.fit();
      } catch {
        // 숨김 상태·패널 애니메이션 중에는 fit 실패를 무시한다.
        return;
      }
      void syncRemoteSize();
    });
  }, [syncRemoteSize]);

  const reconnect = useCallback(async () => {
    const term = termRef.current;
    if (!term || reconnectingRef.current) {
      return;
    }
    const previousId = shellIdRef.current;
    reconnectingRef.current = true;
    pendingOutputRef.current.clear();
    writeBufferRef.current = "";
    setReconnecting(true);
    setReconnectError(null);

    try {
      const { cols, rows } = term;
      const nextId = await openSshShell(cols, rows);
      shellIdRef.current = nextId;
      lastSentSizeRef.current = { shellId: nextId, cols, rows };
      disconnectedRef.current = false;
      setDisconnected(false);
      term.writeln("\x1b[90m[다시 연결되었습니다]\x1b[0m");
      const pending = pendingOutputRef.current.get(nextId);
      if (pending) {
        term.write(pending);
      }
      replaceSessionId(previousId, nextId);
      void closeSshShell(previousId).catch(() => {
        // 이미 닫힌 셸
      });
      scheduleFit();
      term.focus();
    } catch (error) {
      setReconnectError(errorMessage(error));
    } finally {
      reconnectingRef.current = false;
      pendingOutputRef.current.clear();
      setReconnecting(false);
    }
  }, [replaceSessionId, scheduleFit]);

  useEffect(() => {
    reconnectRef.current = () => void reconnect();
  }, [reconnect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rootFontPx = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    // 기본 13px @ 16px root → 0.8125rem
    const termFontSize = Math.round(0.8125 * rootFontPx);

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: termFontSize,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
      },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;
    searchRef.current = searchAddon;

    const resultsDisposable = searchAddon.onDidChangeResults(
      ({ resultIndex, resultCount }) => {
        setSearchResults({ index: resultIndex, count: resultCount });
      },
    );

    term.attachCustomKeyEventHandler((event) => {
      // 찾기 창이 열려 있으면 Esc는 셸로 보내지 않고 찾기 창을 닫는다.
      if (event.key === "Escape" && searchOpenRef.current) {
        event.preventDefault();
        if (event.type === "keydown") {
          closeSearch();
        }
        return false;
      }
      if (!isFindShortcut(event)) {
        return true;
      }
      // 전역 목록 검색(ListSearchProvider)이 같은 단축키를 가로채지 않도록 기본 동작을 막는다.
      event.preventDefault();
      if (event.type === "keydown") {
        const selection = term.hasSelection() ? term.getSelection() : "";
        if (selection && !selection.includes("\n")) {
          setInitialQuery(selection);
        }
        setSearchOpen(true);
        setSearchFocusSignal((signal) => signal + 1);
      }
      return false;
    });

    const dataDisposable = term.onData((data) => {
      if (disconnectedRef.current) {
        if (data === "\r") {
          reconnectRef.current();
        }
        return;
      }
      enqueueWrite(data);
    });

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    void (async () => {
      const unlistenData = await listenSshTerminalData((payload) => {
        if (payload.shellId === shellIdRef.current) {
          term.write(payload.data);
          return;
        }
        if (reconnectingRef.current) {
          const pending = pendingOutputRef.current;
          pending.set(
            payload.shellId,
            (pending.get(payload.shellId) ?? "") + payload.data,
          );
        }
      });
      const unlistenClosed = await listenSshTerminalClosed((payload) => {
        if (payload.shellId === shellIdRef.current) {
          markDisconnected();
        }
      });

      if (cancelled) {
        unlistenData();
        unlistenClosed();
        return;
      }

      unlisteners.push(unlistenData, unlistenClosed);
    })();

    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      dataDisposable.dispose();
      resultsDisposable.dispose();
      resizeObserver.disconnect();
      if (fitFrameRef.current !== null) {
        cancelAnimationFrame(fitFrameRef.current);
        fitFrameRef.current = null;
      }
      for (const unlisten of unlisteners) {
        unlisten();
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
  }, [closeSearch, enqueueWrite, markDisconnected, scheduleFit]);

  const runSearch = useCallback(
    (
      { query, caseSensitive }: TerminalSearchQuery,
      direction: TerminalSearchDirection,
      incremental: boolean,
    ) => {
      const searchAddon = searchRef.current;
      if (!searchAddon) {
        return;
      }
      if (!query) {
        searchAddon.clearDecorations();
        setSearchResults(null);
        return;
      }
      const options: ISearchOptions = {
        caseSensitive,
        incremental,
        decorations: SEARCH_DECORATIONS,
      };
      if (direction === "next") {
        searchAddon.findNext(query, options);
      } else {
        searchAddon.findPrevious(query, options);
      }
    },
    [],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    scheduleFit();
    const frame = requestAnimationFrame(() => termRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, [active, scheduleFit]);

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
      {searchOpen ? (
        <TerminalSearchBar
          initialQuery={initialQuery}
          results={searchResults}
          focusSignal={searchFocusSignal}
          onSearch={runSearch}
          onClose={closeSearch}
        />
      ) : null}
      {disconnected ? (
        <div className="terminal-session__reconnect" role="alert">
          <span className="terminal-session__reconnect-text">
            {reconnectError ?? "세션 연결이 끊어졌습니다."}
          </span>
          <button
            type="button"
            className="terminal-session__reconnect-btn"
            disabled={reconnecting}
            onClick={() => void reconnect()}
          >
            <RefreshIcon
              className={
                reconnecting ? "terminal-session__reconnect-spin" : undefined
              }
            />
            {reconnecting ? "재연결 중…" : "재연결"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
