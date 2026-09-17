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
import { createPortal } from "react-dom";
import "./css/toast.css";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ShowToastOptions {
  message: string;
  variant?: ToastVariant;
  /** ms. 0이면 자동으로 닫지 않습니다. */
  duration?: number;
  /** monospace·줄바꿈 유지 (명령 출력 등) */
  mono?: boolean;
}

interface ToastItem extends Required<Pick<ShowToastOptions, "message">> {
  id: string;
  variant: ToastVariant;
  duration: number;
  mono: boolean;
  exiting: boolean;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
  success: (message: string, options?: Omit<ShowToastOptions, "message" | "variant">) => string;
  error: (message: string, options?: Omit<ShowToastOptions, "message" | "variant">) => string;
  info: (message: string, options?: Omit<ShowToastOptions, "message" | "variant">) => string;
  warning: (message: string, options?: Omit<ShowToastOptions, "message" | "variant">) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4500;
const EXIT_MS = 380;

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const paths: Record<ToastVariant, ReactNode> = {
    success: (
      <path
        d="M5 12.5 9.2 16.5 19 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    error: (
      <>
        <path
          d="M12 7.5v5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16.5" r="1.15" fill="currentColor" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="7.5" r="1.15" fill="currentColor" />
        <path
          d="M12 11v6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    ),
    warning: (
      <>
        <path
          d="M12 8.5v4.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16.6" r="1.15" fill="currentColor" />
      </>
    ),
  };

  return (
    <span className="toast__icon" aria-hidden>
      <svg viewBox="0 0 24 24" width="16" height="16">
        {paths[variant]}
      </svg>
    </span>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [progressReady, setProgressReady] = useState(false);

  useEffect(() => {
    if (toast.duration <= 0 || toast.exiting) return;
    const id = requestAnimationFrame(() => setProgressReady(true));
    return () => cancelAnimationFrame(id);
  }, [toast.duration, toast.exiting]);

  return (
    <div
      className={[
        "toast",
        `toast--${toast.variant}`,
        toast.exiting ? "toast--exit" : "toast--enter",
      ].join(" ")}
      role={toast.variant === "error" ? "alert" : "status"}
    >
      <ToastIcon variant={toast.variant} />
      <div className="toast__body">
        {toast.mono ? (
          <pre className="toast__mono">{toast.message}</pre>
        ) : (
          <p className="toast__message">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        className="toast__dismiss"
        aria-label="닫기"
        onClick={() => onDismiss(toast.id)}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            d="M6.5 6.5l11 11M17.5 6.5l-11 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {toast.duration > 0 && !toast.exiting && (
        <span
          className={[
            "toast__progress",
            progressReady ? "toast__progress--running" : "",
          ].join(" ")}
          style={{ animationDuration: `${toast.duration}ms` }}
          aria-hidden
        />
      )}
    </div>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitingIdsRef = useRef<Set<string>>(new Set());

  const clearTimer = useCallback((map: Map<string, ReturnType<typeof setTimeout>>, id: string) => {
    const timer = map.get(id);
    if (timer) {
      clearTimeout(timer);
      map.delete(id);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    clearTimer(timersRef.current, id);
    clearTimer(exitTimersRef.current, id);
    exitingIdsRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, [clearTimer]);

  const dismissToast = useCallback(
    (id: string) => {
      if (exitingIdsRef.current.has(id)) return;
      exitingIdsRef.current.add(id);
      clearTimer(timersRef.current, id);

      setToasts((current) => {
        if (!current.some((toast) => toast.id === id)) return current;
        return current.map((toast) =>
          toast.id === id ? { ...toast, exiting: true } : toast,
        );
      });

      const exitTimer = setTimeout(() => {
        removeToast(id);
      }, EXIT_MS);
      exitTimersRef.current.set(id, exitTimer);
    },
    [clearTimer, removeToast],
  );

  const showToast = useCallback(
    ({
      message,
      variant = "info",
      duration = DEFAULT_DURATION,
      mono = false,
    }: ShowToastOptions) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const next: ToastItem = {
        id,
        message,
        variant,
        duration,
        mono,
        exiting: false,
      };

      setToasts((current) => [...current, next]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (message, options) =>
        showToast({ ...options, message, variant: "success" }),
      error: (message, options) =>
        showToast({ ...options, message, variant: "error" }),
      info: (message, options) =>
        showToast({ ...options, message, variant: "info" }),
      warning: (message, options) =>
        showToast({ ...options, message, variant: "warning" }),
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
