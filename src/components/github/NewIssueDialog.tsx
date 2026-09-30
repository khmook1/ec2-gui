import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { useCreateGitHubIssueMutation } from "@/hooks/query";
import type { GitHubIssue } from "@/types/github";

interface NewIssueDialogProps {
  open: boolean;
  repo: string;
  onClose: () => void;
  onCreated: (issue: GitHubIssue) => void;
}

interface NewIssueFormValues {
  title: string;
  body: string;
}

const EMPTY_VALUES: NewIssueFormValues = { title: "", body: "" };

export function NewIssueDialog({
  open,
  repo,
  onClose,
  onCreated,
}: NewIssueDialogProps) {
  const createIssue = useCreateGitHubIssueMutation(repo);
  const isSubmitting = createIssue.isPending;
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<NewIssueFormValues>({
    mode: "onChange",
    defaultValues: EMPTY_VALUES,
  });

  function close() {
    reset(EMPTY_VALUES);
    onClose();
  }

  return (
    <AppDialog
      open={open}
      onClose={close}
      title="새 이슈"
      subtitle={repo}
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="github-dialog__body"
    >
      <form
        className="github-form"
        onSubmit={handleSubmit((values) => {
          createIssue.mutate(
            { title: values.title.trim(), body: values.body },
            {
              onSuccess: (issue) => {
                reset(EMPTY_VALUES);
                onCreated(issue);
              },
            },
          );
        })}
      >
        <FormField label="제목" width="wide">
          <input
            type="text"
            autoFocus
            autoComplete="off"
            placeholder="이슈 제목"
            disabled={isSubmitting}
            {...register("title", {
              validate: (value) => value.trim().length > 0,
            })}
          />
        </FormField>
        <FormField label="내용 (Markdown)" width="wide">
          <textarea
            className="github-textarea"
            rows={10}
            placeholder="자세한 설명을 입력하세요."
            disabled={isSubmitting}
            {...register("body")}
          />
        </FormField>
        <div className="github-form__actions">
          <Button variant="ghost" disabled={isSubmitting} onClick={close}>
            취소
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "만드는 중…" : "이슈 만들기"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
