import { useState } from "react";
import { Button } from "@/components/common/Button";
import { PaginatedContent } from "@/components/common/Pagination";
import { IssueDetail } from "@/components/github/IssueDetail";
import { NewIssueDialog } from "@/components/github/NewIssueDialog";
import { IssueList } from "@/components/github/atoms/IssueList";
import { StateFilter } from "@/components/github/atoms/StateFilter";
import { useGitHubIssuesQuery } from "@/hooks/query";
import { usePagination } from "@/hooks/usePagination";
import { githubErrorMessage } from "@/lib/github";
import type { GitHubIssueState, GitHubRepoDetail } from "@/types/github";

export function RepoIssuesTab({ detail }: { detail: GitHubRepoDetail }) {
  const repo = detail.fullName;
  const [state, setState] = useState<GitHubIssueState>("open");
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { page, setPage } = usePagination({ resetDeps: [state] });
  const issuesQuery = useGitHubIssuesQuery(repo, state, page);

  if (openNumber != null) {
    return (
      <IssueDetail
        detail={detail}
        number={openNumber}
        onBack={() => setOpenNumber(null)}
      />
    );
  }

  const issues = issuesQuery.data?.items ?? [];

  return (
    <div className="github-tab-list">
      <div className="github-tab-list__bar">
        <StateFilter value={state} onChange={setState} />
        {!detail.archived ? (
          <Button onClick={() => setIsCreating(true)}>새 이슈</Button>
        ) : null}
      </div>

      {issuesQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(issuesQuery.error, "이슈를 불러오지 못했습니다.")}
        </p>
      ) : null}

      <PaginatedContent
        page={page}
        totalPages={issuesQuery.data?.totalPages ?? 1}
        onChangePage={setPage}
        isFetching={issuesQuery.isFetching}
        loadingMessage="이슈를 불러오는 중"
        ariaLabel="이슈 페이지"
      >
        {issuesQuery.data ? (
          <IssueList
            items={issues}
            emptyText={
              state === "open" ? "열린 이슈가 없습니다." : "닫힌 이슈가 없습니다."
            }
            onOpen={setOpenNumber}
          />
        ) : null}
      </PaginatedContent>

      <NewIssueDialog
        open={isCreating}
        repo={repo}
        onClose={() => setIsCreating(false)}
        onCreated={(issue) => {
          setIsCreating(false);
          setOpenNumber(issue.number);
        }}
      />
    </div>
  );
}
