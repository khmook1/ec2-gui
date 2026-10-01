import { useId } from "react";
import {
  DIALOG_FIND_BAR_CLASS,
  DIALOG_FIND_MAX_MATCHES,
  type DialogFindBarState,
} from "@/hooks/useDialogFind";
import "./css/dialog-find-bar.css";

export function DialogFindBar({
  inputRef,
  query,
  matchCount,
  activeIndex,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: DialogFindBarState) {
  const inputId = useId();
  const hasQuery = query.length > 0;
  const totalLabel =
    matchCount >= DIALOG_FIND_MAX_MATCHES
      ? `${DIALOG_FIND_MAX_MATCHES}+`
      : String(matchCount);
  const statsLabel = !hasQuery
    ? null
    : matchCount === 0
      ? "결과 없음"
      : `${activeIndex + 1} / ${totalLabel}`;

  return (
    <div className={DIALOG_FIND_BAR_CLASS} role="search">
      <label className="dialog-find-bar__label" htmlFor={inputId}>
        다이얼로그에서 찾기
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        className="dialog-find-bar__input"
        placeholder="찾기…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) {
            return;
          }
          event.preventDefault();
          if (event.shiftKey) {
            onPrev();
          } else {
            onNext();
          }
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {statsLabel ? (
        <span
          className={[
            "dialog-find-bar__stats",
            matchCount === 0 ? "dialog-find-bar__stats--empty" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-live="polite"
        >
          {statsLabel}
        </span>
      ) : null}
      <button
        type="button"
        className="dialog-find-bar__button"
        onClick={onPrev}
        disabled={matchCount === 0}
        aria-label="이전 결과"
        title="이전 결과 (Shift+Enter)"
      >
        ↑
      </button>
      <button
        type="button"
        className="dialog-find-bar__button"
        onClick={onNext}
        disabled={matchCount === 0}
        aria-label="다음 결과"
        title="다음 결과 (Enter)"
      >
        ↓
      </button>
      <button
        type="button"
        className="dialog-find-bar__button"
        onClick={onClose}
        aria-label="찾기 닫기"
        title="닫기 (Esc)"
      >
        x
      </button>
    </div>
  );
}
