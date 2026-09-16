import type { CSSProperties } from "react";

const LOADING_ICON_SRC = "/lodding-icon.png";

export interface LoadingIndicatorProps {
  message?: string;
  className?: string;
  /** 아이콘 한 변 길이(px) */
  size?: number;
  /** default: 콘텐츠 영역 / fill: 페이지·패널 전체 / dialog: 다이얼로그 본문 */
  layout?: "default" | "fill" | "dialog";
  /** message가 없을 때 스크린 리더용 */
  label?: string;
  style?: CSSProperties;
}

export function LoadingIndicator({
  message,
  className,
  size = 112,
  layout = "default",
  label = "불러오는 중",
  style,
}: LoadingIndicatorProps) {
  const rootClass = [
    "app-loading",
    layout === "fill" ? "app-loading--fill" : "",
    layout === "dialog" ? "app-loading--dialog" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel = message?.trim() || label;

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      style={style}
    >
      <img
        className="app-loading__image"
        src={LOADING_ICON_SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
        aria-hidden
      />
      {message ? <p className="app-loading__message">{message}</p> : null}
    </div>
  );
}
