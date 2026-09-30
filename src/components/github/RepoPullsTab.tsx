import { useState } from "react";
import { PaginatedContent } from "@/components/common/Pagination";
import { PullDetail } from "@/components/github/PullDetail";
import { IssueList } from "@/components/github/atoms/IssueList";
import { StateFilter } from "@/components/github/atoms/StateFilter";
import { useGitHubPullsQuery } from "@/hooks/query";
import { usePagination } from "@/hooks/usePagination";
import { githubErrorMessage } from "@/lib/github";
import type { GitHubIssueState, GitHubRepoDetail } from "@/types/github";

export function RepoPullsTab({ detail }: { detail: GitHubRepoDetail }) {
  const repo = detail.fullName;
  const [state, setState] = useState<GitHubIssueState>("open");
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const { page, setPage } = usePagination({ resetDeps: [state] });
  const pullsQuery = useGitHubPullsQuery(repo, state, page);

  if (openNumber != null) {
    return (
      <PullDetail
        detail={detail}
        number={openNumber}
        onBack={() => setOpenNumber(null)}
      />
    );
  }

  const items = (pullsQuery.data?.items ?? []).map((pull) => ({
    number: pull.number,
    title: pull.title,
    state: pull.state,
    merged: pull.merged,
    draft: pull.draft,
    user: pull.user,
    createdAt: pull.createdAt,
    extra: (
      <code className="github-ref">
        {pull.headRef} → {pull.baseRef}
      </code>
    ),
  }));

  return (
    <div className="github-tab-list">
      <div className="github-tab-list__bar">
        <StateFilter value={state} onChange={setState} />
      </div>

      {pullsQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(pullsQuery.error, "PR을 불러오지 못했습니다.")}
        </p>
      ) : null}

      <PaginatedContent
        page={page}
        totalPages={pullsQuery.data?.totalPages ?? 1}
        onChangePage={setPage}
        isFetching={pullsQuery.isFetching}
        loadingMessage="PR을 불러오는 중"
        ariaLabel="PR 페이지"
      >
        {pullsQuery.data ? (
          <IssueList
            items={items}
            emptyText={
              state === "open" ? "열린 PR이 없습니다." : "닫힌 PR이 없습니다."
            }
            onOpen={setOpenNumber}
          />
        ) : null}
      </PaginatedContent>
    </div>
  );
}
