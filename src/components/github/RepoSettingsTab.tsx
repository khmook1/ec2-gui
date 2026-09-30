import { useForm } from "react-hook-form";
import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import { FormField, FormSection } from "@/components/common/FormField";
import { useUpdateGitHubRepoMutation } from "@/hooks/query";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import { parseTopics } from "@/lib/github";
import type { GitHubRepoDetail, GitHubRepoUpdate } from "@/types/github";

interface SettingsFormValues {
  description: string;
  homepage: string;
  topics: string;
  visibility: "public" | "private";
  hasIssues: boolean;
}

function toFormValues(detail: GitHubRepoDetail): SettingsFormValues {
  return {
    description: detail.description ?? "",
    homepage: detail.homepage ?? "",
    topics: detail.topics.join(", "),
    visibility: detail.private ? "private" : "public",
    hasIssues: detail.hasIssues,
  };
}

function sameTopics(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

export function RepoSettingsTab({ detail }: { detail: GitHubRepoDetail }) {
  const repo = detail.fullName;
  const updateRepo = useUpdateGitHubRepoMutation(repo);
  const { requestConfirm, confirmDialog } = useDestructiveConfirm();
  const isSaving = updateRepo.isPending;
  const locked = detail.archived || isSaving;
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, dirtyFields },
  } = useForm<SettingsFormValues>({
    values: toFormValues(detail),
  });

  function save(values: SettingsFormValues) {
    const update: GitHubRepoUpdate = {};
    if (dirtyFields.description) {
      update.description = values.description.trim();
    }
    if (dirtyFields.homepage) {
      update.homepage = values.homepage.trim();
    }
    if (dirtyFields.visibility) {
      update.private = values.visibility === "private";
    }
    if (dirtyFields.hasIssues) {
      update.hasIssues = values.hasIssues;
    }
    const topics = parseTopics(values.topics);
    updateRepo.mutate({
      update,
      topics: sameTopics(topics, detail.topics) ? undefined : topics,
    });
  }

  function toggleArchive() {
    if (detail.archived) {
      updateRepo.mutate({ update: { archived: false } });
      return;
    }
    requestConfirm({
      targetId: repo,
      label: repo,
      title: "저장소 아카이브",
      actionName: "아카이브",
      confirmButtonLabel: "아카이브",
      onConfirm: async () => {
        try {
          await updateRepo.mutateAsync({ update: { archived: true } });
        } catch {
          // 실패 안내는 뮤테이션 onError 토스트가 담당
        }
      },
    });
  }

  return (
    <div className="github-settings">
      <form className="github-form github-settings__form" onSubmit={handleSubmit(save)}>
        <FormSection title="General">
          {detail.archived ? (
            <p className="github-settings__notice">
              아카이브된 저장소는 읽기 전용입니다. 설정을 바꾸려면 먼저 아카이브를 해제하세요.
            </p>
          ) : null}
          <FormField label="설명" width="wide">
            <input
              type="text"
              autoComplete="off"
              placeholder="저장소 설명"
              disabled={locked}
              {...register("description")}
            />
          </FormField>
          <FormField label="웹사이트" width="wide">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://example.com"
              disabled={locked}
              {...register("homepage")}
            />
          </FormField>
          <FormField label="토픽 (쉼표·공백 구분, 소문자·숫자·하이픈)" width="wide">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="react, tauri, rust"
              disabled={locked}
              {...register("topics")}
            />
          </FormField>
          <FormField label="공개 범위" width="wide">
            <select
              className="github-select"
              disabled={locked}
              {...register("visibility")}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </FormField>
          <label className="github-checkbox">
            <input type="checkbox" disabled={locked} {...register("hasIssues")} />
            <span>Issues 사용</span>
          </label>
        </FormSection>
        <div className="github-form__actions">
          <Button
            variant="ghost"
            disabled={!isDirty || locked}
            onClick={() => reset(toFormValues(detail))}
          >
            되돌리기
          </Button>
          <Button type="submit" disabled={!isDirty || locked}>
            {isSaving ? "저장 중…" : "변경 사항 저장"}
          </Button>
        </div>
      </form>

      <section className="github-danger-zone">
        <h3 className="github-danger-zone__title">Danger Zone</h3>
        <div className="github-danger-zone__row">
          <div>
            <strong>
              {detail.archived ? "아카이브 해제" : "저장소 아카이브"}
            </strong>
            <p>
              {detail.archived
                ? "저장소를 다시 쓰기 가능한 상태로 되돌립니다."
                : "저장소를 읽기 전용으로 만듭니다. 이슈·PR·push가 막힙니다."}
            </p>
          </div>
          <DangerButton disabled={isSaving} onClick={toggleArchive}>
            {detail.archived ? "아카이브 해제" : "아카이브"}
          </DangerButton>
        </div>
      </section>
      {confirmDialog}
    </div>
  );
}
