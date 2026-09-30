import { useState } from "react";
import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import { PaginatedContent } from "@/components/common/Pagination";
import { BranchIcon } from "@/components/icons/GitHubIcons";
import { CreateBranchDialog } from "@/components/github/CreateBranchDialog";
import {
  useDeleteGitHubBranchMutation,
  useGitHubBranchesQuery,
} from "@/hooks/query";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import { usePagination } from "@/hooks/usePagination";
import { githubErrorMessage } from "@/lib/github";
import type { GitHubRepoDetail } from "@/types/github";

export function RepoBranchesTab({ detail }: { detail: GitHubRepoDetail }) {
  const repo = detail.fullName;
  const [isCreating, setIsCreating] = useState(false);
  const { page, setPage } = usePagination();
  const branchesQuery = useGitHubBranchesQuery(repo, page);
  const deleteBranch = useDeleteGitHubBranchMutation(repo);
  const { requestConfirm, confirmDialog } = useDestructiveConfirm();

  const canWrite =
    !detail.archived && (detail.permissions.push || detail.permissions.admin);
  const branches = branchesQuery.data?.items ?? [];

  function confirmDelete(name: string) {
    requestConfirm({
      targetId: name,
      label: `${name} 브랜치`,
      title: "브랜치 삭제",
      onConfirm: async () => {
        try {
          await deleteBranch.mutateAsync(name);
        } catch {
          // 실패 안내는 뮤테이션 onError 토스트가 담당
        }
      },
    });
  }

  return (
    <div className="github-tab-list">
      <div className="github-tab-list__bar">
        <span className="github-tab-list__hint">
          기본 브랜치 <code className="github-ref">{detail.defaultBranch}</code>
        </span>
        {canWrite ? (
          <Button onClick={() => setIsCreating(true)}>새 브랜치</Button>
        ) : null}
      </div>

      {branchesQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(branchesQuery.error, "브랜치를 불러오지 못했습니다.")}
        </p>
      ) : null}

      <PaginatedContent
        page={page}
        totalPages={branchesQuery.data?.totalPages ?? 1}
        onChangePage={setPage}
        isFetching={branchesQuery.isFetching}
        loadingMessage="브랜치를 불러오는 중"
        ariaLabel="브랜치 페이지"
      >
        <ul className="github-list" role="list">
          {branches.map((branch) => {
            const isDefault = branch.name === detail.defaultBranch;
            const deleteBlocked = isDefault || branch.protected;
            return (
              <li key={branch.name} className="github-branch">
                <BranchIcon className="github-branch__icon" />
                <span className="github-branch__name">{branch.name}</span>
                {isDefault ? (
                  <span className="github-repo__badge">default</span>
                ) : null}
                {branch.protected ? (
                  <span className="github-repo__badge github-repo__badge--private">
                    protected
                  </span>
                ) : null}
                <code className="github-branch__sha">{branch.sha.slice(0, 7)}</code>
                {canWrite ? (
                  <DangerButton
                    className="github-branch__delete"
                    disabled={deleteBlocked}
                    title={
                      isDefault
                        ? "기본 브랜치는 삭제할 수 없습니다"
                        : branch.protected
                          ? "보호된 브랜치는 삭제할 수 없습니다"
                          : undefined
                    }
                    onClick={() => confirmDelete(branch.name)}
                  >
                    삭제
                  </DangerButton>
                ) : null}
              </li>
            );
          })}
          {branchesQuery.data && branches.length === 0 ? (
            <li className="github-list__empty">브랜치가 없습니다.</li>
          ) : null}
        </ul>
      </PaginatedContent>

      <CreateBranchDialog
        open={isCreating}
        repo={repo}
        defaultBranch={detail.defaultBranch}
        branchNames={branches.map((branch) => branch.name)}
        onClose={() => setIsCreating(false)}
      />
      {confirmDialog}
    </div>
  );
}
