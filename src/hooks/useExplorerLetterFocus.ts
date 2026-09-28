import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RemoteEntry } from "@/types/filesystem";

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

function isLetterKey(key: string): boolean {
  return key.length === 1 && /^[a-zA-Z]$/.test(key);
}

function entryStartsWithLetter(name: string, letter: string): boolean {
  const first = name.charAt(0);
  return first.length > 0 && first.toLowerCase() === letter;
}

function scrollSelectedEntryIntoView() {
  requestAnimationFrame(() => {
    const selected = document.querySelector<HTMLElement>(
      ".table-list__row--selected, .explorer-icon-grid__item--selected",
    );
    selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

interface UseExplorerLetterFocusOptions {
  entries: RemoteEntry[];
  selectedPath: string | null;
  selectEntry: (path: string | null) => void;
  /** 다이얼로그 등이 열려 있으면 비활성 */
  enabled?: boolean;
  /** 경로 변경 시 포커스 초기화용 */
  currentPath: string;
}

/**
 * 파일 탐색기에서 a–z 키로 해당 알파벳으로 시작하는 항목을 포커스한다.
 * 같은 키를 반복하면 매칭 항목을 순환하고, 빈 영역 클릭 등으로 선택이 풀리면 포커스도 해제한다.
 */
export function useExplorerLetterFocus({
  entries,
  selectedPath,
  selectEntry,
  enabled = true,
  currentPath,
}: UseExplorerLetterFocusOptions) {
  const [focusLetter, setFocusLetter] = useState<string | null>(null);
  const fromKeyboardRef = useRef(false);
  const selectedPathRef = useRef(selectedPath);
  const focusLetterRef = useRef(focusLetter);

  selectedPathRef.current = selectedPath;
  focusLetterRef.current = focusLetter;

  useEffect(() => {
    setFocusLetter(null);
  }, [currentPath]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.defaultPrevented) {
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
      if (!isLetterKey(event.key)) {
        return;
      }

      const letter = event.key.toLowerCase();
      const matches = entries.filter((entry) =>
        entryStartsWithLetter(entry.name, letter),
      );
      if (matches.length === 0) {
        return;
      }

      event.preventDefault();

      const sameLetter = focusLetterRef.current === letter;
      const currentPathSelected = selectedPathRef.current;
      let next: RemoteEntry;

      if (sameLetter && currentPathSelected) {
        const currentIndex = matches.findIndex(
          (entry) => entry.path === currentPathSelected,
        );
        next =
          currentIndex >= 0
            ? matches[(currentIndex + 1) % matches.length]!
            : matches[0]!;
      } else {
        next = matches[0]!;
      }

      fromKeyboardRef.current = true;
      setFocusLetter(letter);
      selectEntry(next.path);
      scrollSelectedEntryIntoView();
      queueMicrotask(() => {
        fromKeyboardRef.current = false;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, entries, selectEntry]);

  const handleSelectedKeyChange = useCallback(
    (path: string | null) => {
      if (!fromKeyboardRef.current) {
        setFocusLetter(null);
      }
      selectEntry(path);
    },
    [selectEntry],
  );

  const isLetterFocused = useCallback(
    (entry: RemoteEntry) =>
      focusLetter != null && entryStartsWithLetter(entry.name, focusLetter),
    [focusLetter],
  );

  return {
    focusLetter,
    isLetterFocused,
    handleSelectedKeyChange,
  };
}
