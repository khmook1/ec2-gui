import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { isValidRemoteEntryName } from "@/utils/file";
import "./css/create-entry-dialog.css";

export type CreateEntryKind = "file" | "directory";

export interface CreateEntryDialogProps {
  kind: CreateEntryKind | null;
  parentPath: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string; content: string }) => void | Promise<void>;
}

interface CreateEntryFormValues {
  name: string;
  content: string;
}

export function CreateEntryDialog({
  kind,
  parentPath,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
}: CreateEntryDialogProps) {
  const isFile = kind === "file";
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, errors },
  } = useForm<CreateEntryFormValues>({
    mode: "onChange",
    defaultValues: { name: "", content: "" },
  });

  useEffect(() => {
    reset({ name: "", content: "" });
  }, [kind, reset]);

  if (kind == null) {
    return null;
  }

  const title = isFile ? "파일 생성" : "폴더 추가";
  const nameLabel = isFile ? "파일 이름" : "폴더 이름";
  const submitLabel = isFile ? "생성" : "추가";

  return (
    <AppDialog
      open
      onClose={onClose}
      title={title}
      subtitle={parentPath}
      size="confirm"
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="create-entry-dialog__body"
    >
      <form
        className="create-entry-dialog"
        onSubmit={handleSubmit(async (values) => {
          if (isSubmitting) {
            return;
          }
          await onSubmit({
            name: values.name.trim(),
            content: values.content,
          });
        })}
      >
        <FormField label={nameLabel} width="wide">
          <input
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={isFile ? "예: notes.txt" : "예: docs"}
            disabled={isSubmitting}
            aria-invalid={errors.name ? true : undefined}
            {...register("name", {
              required: "이름을 입력하세요.",
              validate: (value) =>
                isValidRemoteEntryName(value) ||
                "올바른 이름을 입력하세요. (/ \\ . .. 불가)",
            })}
          />
        </FormField>
        {errors.name?.message ? (
          <p className="create-entry-dialog__error" role="alert">
            {errors.name.message}
          </p>
        ) : null}

        {isFile ? (
          <FormField label="내용" width="wide">
            <textarea
              rows={8}
              spellCheck={false}
              placeholder="파일 내용을 입력하세요. (비워 두면 빈 파일)"
              disabled={isSubmitting}
              {...register("content")}
            />
          </FormField>
        ) : null}

        {errorMessage ? (
          <p className="create-entry-dialog__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="create-entry-dialog__actions">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onClose}
          >
            취소
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? `${submitLabel} 중…` : submitLabel}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
