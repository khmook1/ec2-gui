import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import {
  useDispatchGitHubWorkflowMutation,
  useGitHubBranchesQuery,
  useGitHubWorkflowDispatchQuery,
} from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import type { GitHubWorkflow, GitHubWorkflowInput } from "@/types/github";

interface RunWorkflowDialogProps {
  open: boolean;
  repo: string;
  workflow: GitHubWorkflow;
  defaultBranch: string;
  onClose: () => void;
}

interface RunWorkflowFormValues {
  gitRef: string;
  /** dispatch 입력 정의 순서와 같은 인덱스 */
  inputs: (string | boolean)[];
}

const BRANCH_SELECT_LIMIT = 100;

function validateInput(input: GitHubWorkflowInput) {
  return (value: string | boolean | undefined): true | string => {
    if (input.kind === "boolean") {
      return true;
    }
    const text = String(value ?? "").trim();
    if (!text) {
      return input.required ? `${input.name}은(는) 필수입니다.` : true;
    }
    if (input.kind === "number" && Number.isNaN(Number(text))) {
      return `${input.name}은(는) 숫자여야 합니다.`;
    }
    return true;
  };
}

export function RunWorkflowDialog({
  open,
  repo,
  workflow,
  defaultBranch,
  onClose,
}: RunWorkflowDialogProps) {
  const dispatch = useDispatchGitHubWorkflowMutation(repo);
  const branchesQuery = useGitHubBranchesQuery(repo, 1, BRANCH_SELECT_LIMIT);
  const isSubmitting = dispatch.isPending;
  const defaultValues: RunWorkflowFormValues = { gitRef: defaultBranch, inputs: [] };
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RunWorkflowFormValues>({
    mode: "onChange",
    defaultValues,
    shouldUnregister: true,
  });
  const gitRef = watch("gitRef");
  const dispatchQuery = useGitHubWorkflowDispatchQuery(
    repo,
    open ? workflow.path : null,
    gitRef,
  );
  const definition = dispatchQuery.data;

  function close() {
    reset(defaultValues);
    onClose();
  }

  const branchNames = branchesQuery.data?.items.map((branch) => branch.name) ?? [];
  if (!branchNames.includes(defaultBranch)) {
    branchNames.unshift(defaultBranch);
  }

  const canSubmit =
    definition?.dispatchable === true && !dispatchQuery.isFetching && !isSubmitting;

  return (
    <AppDialog
      open={open}
      onClose={close}
      title="워크플로 실행"
      subtitle={workflow.name}
      size="confirm"
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="github-dialog__body"
    >
      <form
        className="github-form"
        onSubmit={handleSubmit((values) => {
          if (!definition) {
            return;
          }
          const inputs: Record<string, string | boolean> = {};
          definition.inputs.forEach((input, index) => {
            const value = values.inputs[index];
            if (input.kind === "boolean") {
              inputs[input.name] = Boolean(value);
              return;
            }
            const text = String(value ?? "").trim();
            if (text) {
              inputs[input.name] = text;
            }
          });
          dispatch.mutate(
            {
              workflowId: workflow.id,
              workflowName: workflow.name,
              gitRef: values.gitRef,
              inputs,
            },
            { onSuccess: close },
          );
        })}
      >
        <FormField label="브랜치" width="wide">
          <select
            className="github-select"
            disabled={isSubmitting}
            {...register("gitRef")}
          >
            {branchNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FormField>

        {dispatchQuery.isLoading ? (
          <LoadingIndicator message="워크플로 입력을 불러오는 중" />
        ) : dispatchQuery.error ? (
          <p className="github-form__error" role="alert">
            {githubErrorMessage(dispatchQuery.error, "워크플로 파일을 읽지 못했습니다.")}
          </p>
        ) : definition && !definition.dispatchable ? (
          <p className="github-form__note">
            이 브랜치의 <code className="github-ref">{workflow.path}</code>에{" "}
            <code className="github-ref">workflow_dispatch</code> 트리거가 없어 수동으로
            실행할 수 없습니다.
          </p>
        ) : definition ? (
          definition.inputs.map((input, index) => {
            const field = `inputs.${index}` as const;
            const error = errors.inputs?.[index]?.message;
            const label = input.required ? `${input.name} *` : input.name;
            return (
              <div key={`${gitRef}:${input.name}`} className="github-form__group">
                {input.kind === "boolean" ? (
                  <label className="github-checkbox">
                    <input
                      type="checkbox"
                      disabled={isSubmitting}
                      defaultChecked={input.default === "true"}
                      {...register(field)}
                    />
                    <span>{input.name}</span>
                  </label>
                ) : (
                  <FormField label={label} width="wide">
                    {input.kind === "choice" && input.options.length > 0 ? (
                      <select
                        className="github-select"
                        disabled={isSubmitting}
                        defaultValue={input.default ?? input.options[0]}
                        {...register(field, { validate: validateInput(input) })}
                      >
                        {input.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        inputMode={input.kind === "number" ? "decimal" : undefined}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={isSubmitting}
                        defaultValue={input.default ?? ""}
                        aria-invalid={error ? true : undefined}
                        {...register(field, { validate: validateInput(input) })}
                      />
                    )}
                  </FormField>
                )}
                {input.description ? (
                  <p className="github-form__hint">{input.description}</p>
                ) : null}
                {error ? (
                  <p className="github-form__error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })
        ) : null}

        <div className="github-form__actions">
          <Button variant="ghost" disabled={isSubmitting} onClick={close}>
            취소
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "실행 중…" : "Run workflow"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
