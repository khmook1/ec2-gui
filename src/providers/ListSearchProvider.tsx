import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavStore } from "@/stores/navStore";

export interface ListSearchStats {
  total: number;
  visible: number;
}

interface ListSearchContextValue {
  query: string;
  setQuery: (query: string) => void;
  isBarOpen: boolean;
  openBar: () => void;
  closeBar: () => void;
  stats: ListSearchStats | null;
  setStats: (stats: ListSearchStats | null) => void;
}

const ListSearchContext = createContext<ListSearchContextValue | null>(null);

function ListSearchBar({
  query,
  stats,
  inputRef,
  onQueryChange,
  onClose,
}: {
  query: string;
  stats: ListSearchStats | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onClose: () => void;
}) {
  const hasQuery = query.trim().length > 0;
  const statsLabel =
    hasQuery && stats
      ? stats.visible === stats.total
        ? `${stats.visible}개 항목`
        : `${stats.visible} / ${stats.total}개 일치`
      : null;

  return (
    <div className="list-search-bar" role="search">
      <label className="list-search-bar__label" htmlFor="list-search-input">
        목록 검색
      </label>
      <input
        id="list-search-input"
        ref={inputRef}
        type="search"
        className="list-search-bar__input"
        placeholder="현재 목록에서 찾기…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {statsLabel ? (
        <span className="list-search-bar__stats" aria-live="polite">
          {statsLabel}
        </span>
      ) : null}
      <button
        type="button"
        className="list-search-bar__close"
        onClick={onClose}
        aria-label="검색 닫기"
      >
        x
      </button>
    </div>
  );
}

export function ListSearchProvider({ children }: { children: ReactNode }) {
  const activeId = useNavStore((state) => state.activeId);
  const [query, setQuery] = useState("");
  const [isBarOpen, setIsBarOpen] = useState(false);
  const [stats, setStats] = useState<ListSearchStats | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openBar = useCallback(() => {
    setIsBarOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const closeBar = useCallback(() => {
    setIsBarOpen(false);
    setQuery("");
    setStats(null);
  }, []);

  useEffect(() => {
    setQuery("");
    setStats(null);
    setIsBarOpen(false);
  }, [activeId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isFindShortcut = key === "f" && (event.metaKey || event.ctrlKey);

      if (isFindShortcut) {
        event.preventDefault();
        openBar();
        return;
      }

      if (key === "escape" && isBarOpen) {
        event.preventDefault();
        closeBar();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeBar, isBarOpen, openBar]);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      isBarOpen,
      openBar,
      closeBar,
      stats,
      setStats,
    }),
    [closeBar, isBarOpen, openBar, query, stats],
  );

  return (
    <ListSearchContext.Provider value={value}>
      <div className="main-content__stack">
        {isBarOpen ? (
          <ListSearchBar
            query={query}
            stats={stats}
            inputRef={inputRef}
            onQueryChange={setQuery}
            onClose={closeBar}
          />
        ) : null}
        {children}
      </div>
    </ListSearchContext.Provider>
  );
}

export function useListSearch(): ListSearchContextValue {
  const context = useContext(ListSearchContext);
  if (!context) {
    throw new Error("useListSearch must be used within ListSearchProvider");
  }
  return context;
}
