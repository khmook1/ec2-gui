import { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import { FormField } from "@/components/common/FormField";
import "./css/file-dialog.css";

export interface DestructiveConfirmDialogProps {
  /** 대상 ID(경로·컨테이너 ID 등). null이면 다이얼로그를 렌더하지 않습니다. */
  targetId: string | null;
  label?: string;
  title?: string;
  /** 메시지에 쓰이는 동작명 (예: 삭제, 강제 종료) */
  actionName?: string;
  confirmButtonLabel?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (targetId: string) => void;
}

interface DestructiveConfirmFormValues {
  confirmText: string;
}

export function isDestructiveConfirmText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "삭제" || trimmed.toLowerCase() === "delete";
}

export function DestructiveConfirmDialog({
  targetId,
  label,
  title = "삭제 확인",
  actionName = "삭제",
  confirmButtonLabel = "삭제",
  isSubmitting = false,
  onClose,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const titleId = useId();
  const entryName = useMemo(() => {
    if (label) {
      return label;
    }
    if (!targetId) {
      return "";
    }
    return targetId.split("/").filter(Boolean).pop() ?? targetId;
  }, [label, targetId]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isValid },
  } = useForm<DestructiveConfirmFormValues>({
    mode: "onChange",
    defaultValues: { confirmText: "" },
  });

  const confirmText = watch("confirmText");
  const canSubmit = isDestructiveConfirmText(confirmText) && isValid;

  useEffect(() => {
    reset({ confirmText: "" });
  }, [targetId, reset]);

  useEffect(() => {
    if (!targetId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [targetId, onClose, isSubmitting]);

  if (!targetId) {
    return null;
  }

  return createPortal(
    <div
      className="file-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="file-dialog file-dialog--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="file-dialog__header">
          <div className="file-dialog__heading">
            <h2 id={titleId} className="file-dialog__title">
              {title}
            </h2>
            <p className="file-dialog__path">{targetId}</p>
          </div>
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
            닫기
          </Button>
        </header>

        <form
          className="file-dialog__confirm"
          onSubmit={handleSubmit(() => {
            if (!canSubmit || isSubmitting) {
              return;
            }
            onConfirm(targetId);
          })}
        >
          <p className="file-dialog__confirm-message">
            <strong>{entryName}</strong>을(를) {actionName}하려면 아래에{" "}
            <code>삭제</code> 또는 <code>delete</code>를 입력하세요.
          </p>

          <FormField label="확인 문구" width="wide">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="삭제 또는 delete"
              disabled={isSubmitting}
              {...register("confirmText", {
                validate: (value) =>
                  isDestructiveConfirmText(value) ||
                  "삭제 또는 delete를 입력하세요.",
              })}
            />
          </FormField>

          <div className="file-dialog__confirm-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={onClose}
            >
              취소
            </Button>
            <DangerButton type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? `${confirmButtonLabel} 중…` : confirmButtonLabel}
            </DangerButton>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
