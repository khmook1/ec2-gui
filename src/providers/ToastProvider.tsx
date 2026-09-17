import {
  createContext,
  useCallback,
  useContext,
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

function ToastViewport({ toasts, onDismiss }: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={["toast", `toast--${toast.variant}`].join(" ")}
          role={toast.variant === "error" ? "alert" : "status"}
        >
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
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

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
