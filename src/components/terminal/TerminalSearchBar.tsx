import { useEffect, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import "./css/terminal-search.css";

export type TerminalSearchDirection = "next" | "previous";

export interface TerminalSearchQuery {
  query: string;
  caseSensitive: boolean;
}

export interface TerminalSearchResults {
  index: number;
  count: number;
}

interface TerminalSearchBarProps {
  initialQuery: string;
  results: TerminalSearchResults | null;
  /** 값이 바뀔 때마다 입력창에 다시 포커스 (Cmd+F 재입력) */
  focusSignal: number;
  onSearch: (
    search: TerminalSearchQuery,
    direction: TerminalSearchDirection,
    incremental: boolean,
  ) => void;
  onClose: () => void;
}

function formatResults(
  query: string,
  results: TerminalSearchResults | null,
): string {
  if (!query) {
    return "";
  }
  if (!results || results.count === 0) {
    return "결과 없음";
  }
  if (results.index < 0) {
    return `${results.count}+개`;
  }
  return `${results.index + 1}/${results.count}`;
}

export function TerminalSearchBar({
  initialQuery,
  results,
  focusSignal,
  onSearch,
  onClose,
}: TerminalSearchBarProps) {
  const { register, watch, getValues, setFocus } =
    useForm<TerminalSearchQuery>({
      defaultValues: { query: initialQuery, caseSensitive: false },
    });

  useEffect(() => {
    setFocus("query", { shouldSelect: true });
  }, [focusSignal, setFocus]);

  useEffect(() => {
    const initial = getValues();
    if (initial.query) {
      onSearch(initial, "next", false);
    }
    const subscription = watch((values) => {
      onSearch(
        {
          query: values.query ?? "",
          caseSensitive: values.caseSensitive ?? false,
        },
        "next",
        true,
      );
    });
    return () => subscription.unsubscribe();
  }, [getValues, onSearch, watch]);

  const query = watch("query");
  const hasMatches = (results?.count ?? 0) > 0;
  const noMatch = Boolean(query) && !hasMatches;

  function search(direction: TerminalSearchDirection) {
    onSearch(getValues(), direction, false);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      search(event.shiftKey ? "previous" : "next");
      return;
    }
    if (event.metaKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.currentTarget.select();
    }
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <form
      className="terminal-search"
      role="search"
      aria-label="터미널 내용 찾기"
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={handleFormKeyDown}
    >
      <input
        {...register("query")}
        className={[
          "terminal-search__input",
          noMatch ? "terminal-search__input--no-match" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        type="text"
        placeholder="찾기"
        aria-label="찾을 내용"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={handleInputKeyDown}
      />
      <label
        className="terminal-search__toggle"
        title="대/소문자 구분"
      >
        <input type="checkbox" {...register("caseSensitive")} />
        <span aria-hidden>Aa</span>
      </label>
      <span className="terminal-search__count" aria-live="polite">
        {formatResults(query, results)}
      </span>
      <button
        type="button"
        className="terminal-search__btn"
        title="이전 결과 (Shift+Enter)"
        aria-label="이전 결과"
        disabled={!hasMatches}
        onClick={() => search("previous")}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="terminal-search__btn"
        title="다음 결과 (Enter)"
        aria-label="다음 결과"
        disabled={!hasMatches}
        onClick={() => search("next")}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        className="terminal-search__btn"
        title="닫기 (Esc)"
        aria-label="찾기 닫기"
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </form>
  );
}
