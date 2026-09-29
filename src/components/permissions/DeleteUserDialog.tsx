import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import { isDestructiveConfirmText } from "@/components/common/DestructiveConfirmDialog";
import { FormField } from "@/components/common/FormField";
import type { RemoteUser } from "@/types/permissions";
import "./css/permissions.css";

interface DeleteUserDialogProps {
  user: RemoteUser | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (values: { removeHome: boolean }) => void | Promise<void>;
}

interface DeleteUserFormValues {
  confirmText: string;
  removeHome: boolean;
}

export function DeleteUserDialog({
  user,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onConfirm,
}: DeleteUserDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<DeleteUserFormValues>({
    mode: "onChange",
    defaultValues: { confirmText: "", removeHome: false },
  });

  useEffect(() => {
    reset({ confirmText: "", removeHome: false });
  }, [user, reset]);

  if (!user) {
    return null;
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      title="사용자 삭제"
      subtitle={user.username}
      size="confirm"
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="perm-dialog__body"
    >
      <form
        className="perm-dialog"
        onSubmit={handleSubmit(async (values) => {
          if (isSubmitting) {
            return;
          }
          await onConfirm({ removeHome: values.removeHome });
        })}
      >
        <p className="perm-dialog__message">
          <strong>{user.username}</strong> 계정을 삭제하려면 아래에{" "}
          <code>삭제</code> 또는 <code>delete</code>를 입력하세요. 앱이 부여한
          sudo 설정도 함께 제거됩니다.
        </p>

        <label className="perm-dialog__check perm-dialog__check--standalone">
          <input
            type="checkbox"
            disabled={isSubmitting}
            {...register("removeHome")}
          />
          <span>홈 디렉터리({user.home})도 삭제</span>
        </label>

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

        {errorMessage ? (
          <p className="perm-dialog__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="perm-dialog__actions">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onClose}
          >
            취소
          </Button>
          <DangerButton type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "삭제 중…" : "삭제"}
          </DangerButton>
        </div>
      </form>
    </AppDialog>
  );
}
