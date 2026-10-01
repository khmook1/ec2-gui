import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export const DIALOG_FIND_BAR_CLASS = "dialog-find-bar";
export const DIALOG_FIND_MAX_MATCHES = 1000;

const MATCH_HIGHLIGHT = "dialog-find-match";
const CURRENT_HIGHLIGHT = "dialog-find-current";

type FindMatch =
  | { kind: "text"; range: Range }
  | {
      kind: "field";
      element: HTMLTextAreaElement;
      start: number;
      end: number;
    };

export interface DialogFindBarState {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  matchCount: number;
  activeIndex: number;
  onQueryChange: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function supportsHighlights(): boolean {
  return (
    typeof CSS !== "undefined" &&
    "highlights" in CSS &&
    typeof Highlight !== "undefined"
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInsideFindBar(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(`.${DIALOG_FIND_BAR_CLASS}`));
}

function isTopmostDialog(dialog: HTMLElement): boolean {
  const dialogs = document.querySelectorAll(
    '[role="dialog"][aria-modal="true"]',
  );
  return dialogs[dialogs.length - 1] === dialog;
}

interface TextSegment {
  node: Text;
  start: number;
}

/** from부터 다음 세그먼트 시작 오프셋이 조건을 만족하는 동안 전진한 인덱스 */
function findSegmentIndex(
  segments: TextSegment[],
  from: number,
  shouldAdvance: (nextStart: number) => boolean,
): number {
  let index = from;
  for (
    let next = segments[index + 1];
    next && shouldAdvance(next.start);
    next = segments[index + 1]
  ) {
    index += 1;
  }
  return index;
}

function collectMatches(root: HTMLElement, query: string): FindMatch[] {
  const pattern = new RegExp(escapeRegExp(query), "gi");
  const matches: FindMatch[] = [];
  let segments: TextSegment[] = [];
  let text = "";

  // 구문 강조로 토큰이 여러 텍스트 노드로 쪼개져도 이어서 매칭되도록 연속 텍스트를 합쳐 검색
  function flushText() {
    let segmentIndex = 0;
    for (const match of text ? text.matchAll(pattern) : []) {
      if (matches.length >= DIALOG_FIND_MAX_MATCHES) {
        break;
      }
      const start = match.index ?? 0;
      const end = start + match[0].length;
      segmentIndex = findSegmentIndex(
        segments,
        segmentIndex,
        (next) => next <= start,
      );
      const endIndex = findSegmentIndex(
        segments,
        segmentIndex,
        (next) => next < end,
      );
      const startSegment = segments[segmentIndex];
      const endSegment = segments[endIndex];
      if (!startSegment || !endSegment) {
        continue;
      }
      const range = document.createRange();
      range.setStart(startSegment.node, start - startSegment.start);
      range.setEnd(endSegment.node, end - endSegment.start);
      matches.push({ kind: "text", range });
    }
    segments = [];
    text = "";
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node instanceof Text) {
          return node.parentElement?.tagName === "TEXTAREA"
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
        if (!(node instanceof HTMLElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (
          node.classList.contains(DIALOG_FIND_BAR_CLASS) ||
          node.tagName === "SCRIPT" ||
          node.tagName === "STYLE" ||
          node.hidden
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.tagName === "TEXTAREA"
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );

  for (
    let node = walker.nextNode();
    node && matches.length < DIALOG_FIND_MAX_MATCHES;
    node = walker.nextNode()
  ) {
    if (node instanceof Text) {
      segments.push({ node, start: text.length });
      text += node.data;
      continue;
    }
    if (node instanceof HTMLTextAreaElement) {
      flushText();
      for (const match of node.value.matchAll(pattern)) {
        if (matches.length >= DIALOG_FIND_MAX_MATCHES) {
          break;
        }
        const start = match.index ?? 0;
        matches.push({
          kind: "field",
          element: node,
          start,
          end: start + match[0].length,
        });
      }
    }
  }
  flushText();

  return matches;
}

function findScrollContainer(
  from: Element | null,
  axis: "x" | "y",
): HTMLElement | null {
  for (let element = from; element; element = element.parentElement) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }
    const style = getComputedStyle(element);
    const overflow = axis === "y" ? style.overflowY : style.overflowX;
    const scrollable =
      axis === "y"
        ? element.scrollHeight > element.clientHeight
        : element.scrollWidth > element.clientWidth;
    if (/(auto|scroll)/.test(overflow) && scrollable) {
      return element;
    }
  }
  return null;
}

function scrollRangeIntoView(range: Range) {
  const from =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;

  const vertical = findScrollContainer(from, "y");
  if (vertical) {
    const rect = range.getBoundingClientRect();
    const box = vertical.getBoundingClientRect();
    if (rect.top < box.top || rect.bottom > box.bottom) {
      vertical.scrollTop += rect.top - box.top - box.height / 2 + rect.height / 2;
    }
  }

  const horizontal = findScrollContainer(from, "x");
  if (horizontal) {
    const rect = range.getBoundingClientRect();
    const box = horizontal.getBoundingClientRect();
    if (rect.left < box.left || rect.right > box.right) {
      horizontal.scrollLeft += rect.left - box.left - box.width / 2;
    }
  }
}

function revealFieldMatch(match: Extract<FindMatch, { kind: "field" }>) {
  const { element, start, end } = match;
  const previousFocus = document.activeElement;
  element.setSelectionRange(start, end);
  // 일부 WebKit은 setSelectionRange 시 포커스를 옮기므로 찾기 입력 포커스를 유지
  if (
    previousFocus instanceof HTMLElement &&
    document.activeElement !== previousFocus
  ) {
    previousFocus.focus({ preventScroll: true });
  }

  const before = element.value.slice(0, start);
  const lineIndex = before.split("\n").length - 1;
  const column = start - (before.lastIndexOf("\n") + 1);
  const style = getComputedStyle(element);
  const fontSize = parseFloat(style.fontSize) || 12;
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5;
  const paddingTop = parseFloat(style.paddingTop) || 0;

  element.scrollTop =
    paddingTop + lineIndex * lineHeight - element.clientHeight / 2;
  // 모노스페이스 폰트 기준 대략적인 글자 폭
  element.scrollLeft = Math.max(
    0,
    column * fontSize * 0.6 - element.clientWidth / 2,
  );
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function revealMatch(match: FindMatch) {
  if (match.kind === "text") {
    scrollRangeIntoView(match.range);
  } else {
    revealFieldMatch(match);
  }
}

/** 다이얼로그 안에서 Ctrl/Cmd+F로 텍스트 찾기 */
export function useDialogFind(
  enabled: boolean,
  dialogRef: RefObject<HTMLElement | null>,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef("");

  const openBar = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const closeBar = useCallback(() => {
    const current = matches[activeIndex];
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
    if (current?.kind === "field" && current.element.isConnected) {
      current.element.focus();
      current.element.setSelectionRange(current.start, current.end);
    }
  }, [activeIndex, matches]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
  }, []);

  const moveBy = useCallback(
    (delta: number) => {
      const nextIndex =
        (activeIndex + delta + matches.length) % matches.length;
      const next = matches[nextIndex];
      if (!next) {
        return;
      }
      setActiveIndex(nextIndex);
      revealMatch(next);
    },
    [activeIndex, matches],
  );

  const goNext = useCallback(() => moveBy(1), [moveBy]);
  const goPrev = useCallback(() => moveBy(-1), [moveBy]);

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      setQuery("");
      setActiveIndex(0);
    }
  }, [enabled]);

  useEffect(() => {
    const root = dialogRef.current;
    const queryChanged = lastQueryRef.current !== query;
    lastQueryRef.current = query;
    if (!enabled || !isOpen || !root || query === "") {
      setMatches([]);
      return;
    }
    const next = collectMatches(root, query);
    setMatches(next);
    if (queryChanged) {
      if (next[0]) {
        revealMatch(next[0]);
      }
    } else {
      // 내용이 바뀌어 다시 검색한 경우: 입력 중인 textarea 커서를 건드리지 않도록 스크롤 없이 인덱스만 보정
      setActiveIndex((index) =>
        Math.min(index, Math.max(next.length - 1, 0)),
      );
    }
  }, [dialogRef, enabled, isOpen, query, refreshToken]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!enabled || !isOpen || !root) {
      return;
    }

    let frame = 0;
    const scheduleRefresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRefreshToken((token) => token + 1));
    };

    const observer = new MutationObserver((records) => {
      if (records.every((record) => isInsideFindBar(record.target))) {
        return;
      }
      scheduleRefresh();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const handleInput = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement) {
        scheduleRefresh();
      }
    };
    root.addEventListener("input", handleInput);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("input", handleInput);
    };
  }, [dialogRef, enabled, isOpen]);

  useEffect(() => {
    const current = matches[activeIndex];

    if (supportsHighlights()) {
      const ranges = matches.flatMap((match) =>
        match.kind === "text" ? [match.range] : [],
      );
      CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...ranges));
      if (current?.kind === "text") {
        const highlight = new Highlight(current.range);
        highlight.priority = 1;
        CSS.highlights.set(CURRENT_HIGHLIGHT, highlight);
      } else {
        CSS.highlights.delete(CURRENT_HIGHLIGHT);
      }
    }

    return () => {
      if (supportsHighlights()) {
        CSS.highlights.delete(MATCH_HIGHLIGHT);
        CSS.highlights.delete(CURRENT_HIGHLIGHT);
      }
    };
  }, [activeIndex, matches]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog || !isTopmostDialog(dialog)) {
        return;
      }
      const key = event.key.toLowerCase();
      const withModifier = event.metaKey || event.ctrlKey;

      if (key === "f" && withModifier && !event.altKey) {
        event.preventDefault();
        openBar();
        return;
      }

      if (!isOpen) {
        return;
      }

      if (key === "g" && withModifier) {
        event.preventDefault();
        if (event.shiftKey) {
          goPrev();
        } else {
          goNext();
        }
        return;
      }

      if (key === "escape") {
        // 다이얼로그 자체의 Escape 닫기보다 찾기 바 닫기를 우선
        event.preventDefault();
        event.stopPropagation();
        closeBar();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeBar, dialogRef, enabled, goNext, goPrev, isOpen, openBar]);

  const barState: DialogFindBarState = {
    inputRef,
    query,
    matchCount: matches.length,
    activeIndex,
    onQueryChange: handleQueryChange,
    onNext: goNext,
    onPrev: goPrev,
    onClose: closeBar,
  };

  return { isOpen, barState };
}
