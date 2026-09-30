import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { useMergeGitHubPullMutation } from "@/hooks/query";
import {
  GITHUB_MERGE_METHOD_OPTIONS,
  type GitHubMergeMethod,
  type GitHubPull,
} from "@/types/github";

interface MergePullDialogProps {
  repo: string;
  /** null이면 닫힘 */
  pull: GitHubPull | null;
  onClose: () => void;
}

interface MergeFormValues {
  method: GitHubMergeMethod;
  commitTitle: string;
}

export function MergePullDialog({ repo, pull, onClose }: MergePullDialogProps) {
  const merge = useMergeGitHubPullMutation(repo);
  const isSubmitting = merge.isPending;
  const { register, handleSubmit, watch } = useForm<MergeFormValues>({
    values: {
      method: "merge",
      commitTitle: pull ? `${pull.title} (#${pull.number})` : "",
    },
  });
  const method = watch("method");

  if (pull == null) {
    return null;
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      title={`#${pull.number} 머지`}
      subtitle={`${pull.headRef} → ${pull.baseRef}`}
      size="confirm"
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="github-dialog__body"
    >
      <form
        className="github-form"
        onSubmit={handleSubmit((values) => {
          merge.mutate(
            {
              number: pull.number,
              method: values.method,
              commitTitle:
                values.method === "rebase" ? null : values.commitTitle.trim() || null,
            },
            {
              onSuccess: (result) => {
                if (result.merged) {
                  onClose();
                }
              },
            },
          );
        })}
      >
        <FormField label="머지 방식" width="wide">
          <select
            className="github-select"
            disabled={isSubmitting}
            {...register("method")}
          >
            {GITHUB_MERGE_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        {method !== "rebase" ? (
          <FormField label="커밋 제목" width="wide">
            <input
              type="text"
              autoComplete="off"
              disabled={isSubmitting}
              {...register("commitTitle")}
            />
          </FormField>
        ) : null}
        <div className="github-form__actions">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "머지 중…" : "머지"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
