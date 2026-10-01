import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { validateUserPassword } from "@/components/permissions/utils/permissionUi";
import type { RemoteUser } from "@/types/permissions";
import "./css/permissions.css";

interface SetPasswordDialogProps {
  user: RemoteUser | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: { password: string }) => void | Promise<void>;
}

interface SetPasswordFormValues {
  password: string;
  passwordConfirm: string;
}

const DEFAULT_VALUES: SetPasswordFormValues = {
  password: "",
  passwordConfirm: "",
};

export function SetPasswordDialog({
  user,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
}: SetPasswordDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, errors },
  } = useForm<SetPasswordFormValues>({
    mode: "onChange",
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    reset(DEFAULT_VALUES);
  }, [user, reset]);

  if (!user) {
    return null;
  }

  const fieldError = errors.password?.message ?? errors.passwordConfirm?.message;

  return (
    <AppDialog
      open
      onClose={onClose}
      title="비밀번호 설정"
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
          await onSubmit({ password: values.password });
        })}
      >
        <FormField label="새 비밀번호" width="wide">
          <input
            type="password"
            autoFocus
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={errors.password ? true : undefined}
            {...register("password", {
              validate: validateUserPassword,
              deps: ["passwordConfirm"],
            })}
          />
        </FormField>

        <FormField label="비밀번호 확인" width="wide">
          <input
            type="password"
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={errors.passwordConfirm ? true : undefined}
            {...register("passwordConfirm", {
              validate: (value, form) =>
                value === form.password || "비밀번호가 일치하지 않습니다.",
            })}
          />
        </FormField>

        {fieldError ? (
          <p className="perm-dialog__error" role="alert">
            {fieldError}
          </p>
        ) : (
          <p className="perm-dialog__hint">
            sudo·su 인증에 쓰입니다. SSH 비밀번호 로그인은 서버의 sshd
            설정(PasswordAuthentication)에 따라 막혀 있을 수 있습니다.
          </p>
        )}

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
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "설정 중…" : "설정"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
