import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import "./css/button.css";

type ButtonVariant = "primary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** true면 Enter 키로 버튼 클릭을 트리거합니다. */
  activateOnEnter?: boolean;
}

export function Button({
  variant = "primary",
  activateOnEnter = false,
  className,
  disabled,
  type = "button",
  onKeyDown,
  children,
  ...rest
}: ButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!activateOnEnter) return;

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.defaultPrevented || disabled) return;
      if (event.isComposing) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      // submit 버튼은 폼 내 입력에서 Enter로 이미 제출되므로 중복 클릭 방지
      if (
        type === "submit" &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("button, a, [role='button']")
      ) {
        return;
      }

      event.preventDefault();
      buttonRef.current?.click();
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [activateOnEnter, disabled, type]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || !activateOnEnter) return;
    if (event.key === "Enter" && !disabled && !event.nativeEvent.isComposing) {
      event.preventDefault();
      buttonRef.current?.click();
    }
  }

  const classes = ["btn", `btn--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={buttonRef}
      type={type}
      className={classes}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </button>
  );
}
