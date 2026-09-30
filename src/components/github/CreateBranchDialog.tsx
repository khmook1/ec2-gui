import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { useCreateGitHubBranchMutation } from "@/hooks/query";

interface CreateBranchDialogProps {
  open: boolean;
  repo: string;
  defaultBranch: string;
  /** 기준 브랜치 후보 */
  branchNames: string[];
  onClose: () => void;
}

interface CreateBranchFormValues {
  name: string;
  from: string;
}

const INVALID_BRANCH_CHARS = /[\s~^:?*[\\]/;

function validateBranchName(value: string): true | string {
  const name = value.trim();
  if (!name) {
    return "브랜치 이름을 입력하세요.";
  }
  if (
    INVALID_BRANCH_CHARS.test(name) ||
    name.includes("..") ||
    name.includes("//") ||
    name.startsWith("/") ||
    name.endsWith("/") ||
    name.endsWith(".lock")
  ) {
    return "공백, ~ ^ : ? * [ \\, .., // 등은 사용할 수 없습니다.";
  }
  return true;
}

export function CreateBranchDialog({
  open,
  repo,
  defaultBranch,
  branchNames,
  onClose,
}: CreateBranchDialogProps) {
  const createBranch = useCreateGitHubBranchMutation(repo);
  const isSubmitting = createBranch.isPending;
  const defaultValues = { name: "", from: defaultBranch };
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, errors },
  } = useForm<CreateBranchFormValues>({
    mode: "onChange",
    defaultValues,
  });

  function close() {
    reset(defaultValues);
    onClose();
  }

  const fromOptions = branchNames.includes(defaultBranch)
    ? branchNames
    : [defaultBranch, ...branchNames];

  return (
    <AppDialog
      open={open}
      onClose={close}
      title="새 브랜치"
      subtitle={repo}
      size="confirm"
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="github-dialog__body"
    >
      <form
        className="github-form"
        onSubmit={handleSubmit((values) => {
          createBranch.mutate(
            { name: values.name.trim(), from: values.from },
            { onSuccess: close },
          );
        })}
      >
        <FormField label="브랜치 이름" width="wide">
          <input
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="예: feature/login"
            disabled={isSubmitting}
            aria-invalid={errors.name ? true : undefined}
            {...register("name", { validate: validateBranchName })}
          />
        </FormField>
        {errors.name?.message ? (
          <p className="github-form__error" role="alert">
            {errors.name.message}
          </p>
        ) : null}
        <FormField label="기준 브랜치" width="wide">
          <select
            className="github-select"
            disabled={isSubmitting}
            {...register("from")}
          >
            {fromOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="github-form__actions">
          <Button variant="ghost" disabled={isSubmitting} onClick={close}>
            취소
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "만드는 중…" : "브랜치 만들기"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
