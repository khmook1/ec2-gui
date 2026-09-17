import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/common/Button";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import "./css/file-dialog.css";

export type AppDialogSize = "default" | "wide" | "confirm";

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  busy?: boolean;
  size?: AppDialogSize;
  /** true면 Escape·백드롭 클릭·닫기 버튼 비활성 */
  closeDisabled?: boolean;
  /** 헤더와 본문 사이 메타 행 (파일 크기 등) */
  meta?: ReactNode;
  /** 헤더와 본문 사이 추가 영역 (탭 등) */
  toolbar?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}

const SIZE_CLASS: Record<AppDialogSize, string> = {
  default: "",
  wide: "file-dialog--wide",
  confirm: "file-dialog--confirm",
};

export function AppDialog({
  open,
  onClose,
  title,
  subtitle,
  busy = false,
  size = "default",
  closeDisabled = false,
  meta,
  toolbar,
  bodyClassName,
  children,
}: AppDialogProps) {
  const titleId = useId();

  useEscapeKey(open && !closeDisabled, onClose);

  if (!open) {
    return null;
  }

  const sizeClass = SIZE_CLASS[size];

  return createPortal(
    <div
      className="file-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !closeDisabled
        ) {
          onClose();
        }
      }}
    >
      <div
        className={["file-dialog", sizeClass].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
      >
        <header className="file-dialog__header">
          <div className="file-dialog__heading">
            <h2 id={titleId} className="file-dialog__title">
              {title}
            </h2>
            {subtitle != null && subtitle !== "" ? (
              <p className="file-dialog__path">{subtitle}</p>
            ) : null}
          </div>
          <Button variant="ghost" disabled={closeDisabled} onClick={onClose}>
            닫기
          </Button>
        </header>

        {meta != null ? (
          <div className="file-dialog__meta">{meta}</div>
        ) : null}

        {toolbar}

        <div
          className={["file-dialog__body", bodyClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
