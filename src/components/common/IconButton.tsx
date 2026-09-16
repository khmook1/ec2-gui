import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonProps } from "@/components/common/Button";

export type IconButtonTone = "accent" | "success" | "neutral";
export type IconButtonVariant = "default" | "close";

export interface IconButtonProps extends Omit<ButtonProps, "variant" | "children"> {
  tone?: IconButtonTone;
  /** `close`면 × 아이콘과 기본 라벨을 사용합니다. */
  variant?: IconButtonVariant;
  /** 있으면 hover·focus 시 툴팁을 표시합니다. */
  tooltip?: string;
  children?: ReactNode;
}

export function IconButton({
  tone = "neutral",
  variant = "default",
  tooltip,
  className,
  children,
  "aria-label": ariaLabel,
  ...rest
}: IconButtonProps) {
  const tooltipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isClose = variant === "close";
  const resolvedTooltip = tooltip ?? (isClose ? "닫기" : undefined);
  const resolvedAriaLabel = ariaLabel ?? resolvedTooltip;
  const resolvedChildren = isClose ? (
    <span aria-hidden>×</span>
  ) : (
    children
  );

  const classes = [
    "icon-btn",
    `icon-btn--${tone}`,
    isClose ? "icon-btn--close" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const updateTooltipPos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const showTooltip = useCallback(() => {
    updateTooltipPos();
    setTooltipVisible(true);
  }, [updateTooltipPos]);

  const hideTooltip = useCallback(() => {
    setTooltipVisible(false);
  }, []);

  function handleWrapBlur(event: FocusEvent<HTMLSpanElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    hideTooltip();
  }

  useEffect(() => {
    if (!resolvedTooltip || !tooltipVisible) return;

    updateTooltipPos();
    window.addEventListener("scroll", updateTooltipPos, true);
    window.addEventListener("resize", updateTooltipPos);
    return () => {
      window.removeEventListener("scroll", updateTooltipPos, true);
      window.removeEventListener("resize", updateTooltipPos);
    };
  }, [resolvedTooltip, tooltipVisible, updateTooltipPos]);

  const button = (
    <Button
      type="button"
      variant="ghost"
      className={classes}
      aria-label={resolvedAriaLabel}
      aria-describedby={
        resolvedTooltip && tooltipVisible ? tooltipId : undefined
      }
      {...rest}
    >
      <span className="icon-btn__glyph" aria-hidden>
        {resolvedChildren}
      </span>
    </Button>
  );

  if (!resolvedTooltip) {
    return button;
  }

  const tooltipNode = (
    <span
      id={tooltipId}
      className={[
        "icon-btn-tooltip",
        "icon-btn-tooltip--fixed",
        tooltipVisible ? "icon-btn-tooltip--visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="tooltip"
      style={{
        left: tooltipPos.x,
        top: tooltipPos.y,
      }}
    >
      {resolvedTooltip}
    </span>
  );

  return (
    <span
      ref={wrapRef}
      className="icon-btn-wrap"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={handleWrapBlur}
    >
      {button}
      {createPortal(tooltipNode, document.body)}
    </span>
  );
}
