import { useState } from "react";
import { Button } from "@/components/common/Button";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { PaginatedContent } from "@/components/common/Pagination";
import { PlayIcon } from "@/components/icons/GitHubIcons";
import { RunWorkflowDialog } from "@/components/github/RunWorkflowDialog";
import { WorkflowRunDetail } from "@/components/github/WorkflowRunDetail";
import { RunList } from "@/components/github/atoms/RunList";
import { WorkflowList } from "@/components/github/atoms/WorkflowList";
import { useGitHubWorkflowRunsQuery, useGitHubWorkflowsQuery } from "@/hooks/query";
import { usePagination } from "@/hooks/usePagination";
import { githubErrorMessage } from "@/lib/github";
import type { GitHubRepoDetail } from "@/types/github";

export function RepoActionsTab({ detail }: { detail: GitHubRepoDetail }) {
  const repo = detail.fullName;
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [openRunId, setOpenRunId] = useState<number | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const { page, setPage } = usePagination({ resetDeps: [workflowId] });
  const workflowsQuery = useGitHubWorkflowsQuery(repo);
  const runsQuery = useGitHubWorkflowRunsQuery(repo, workflowId, page);

  const { permissions } = detail;
  const canWrite = !detail.archived && (permissions.push || permissions.admin);
  const workflows = workflowsQuery.data ?? [];
  const selected = workflows.find((workflow) => workflow.id === workflowId) ?? null;

  if (openRunId != null) {
    return (
      <WorkflowRunDetail
        detail={detail}
        runId={openRunId}
        onBack={() => setOpenRunId(null)}
      />
    );
  }

  if (workflowsQuery.isLoading) {
    return <LoadingIndicator message="워크플로를 불러오는 중" />;
  }

  return (
    <div className="github-actions">
      <aside className="github-actions__side">
        <h3 className="github-actions__side-title">Actions</h3>
        {workflowsQuery.error ? (
          <p className="explorer-error" role="alert">
            {githubErrorMessage(workflowsQuery.error, "워크플로를 불러오지 못했습니다.")}
          </p>
        ) : (
          <WorkflowList
            workflows={workflows}
            selectedId={workflowId}
            onSelect={setWorkflowId}
          />
        )}
      </aside>

      <div className="github-tab-list github-actions__main">
        <div className="github-tab-list__bar github-actions__bar">
          <div className="github-actions__heading">
            <strong>{selected ? selected.name : "All workflows"}</strong>
            {selected ? <code className="github-ref">{selected.path}</code> : null}
          </div>
          {selected && canWrite && selected.state === "active" ? (
            <Button onClick={() => setDispatchOpen(true)}>
              <PlayIcon />
              Run workflow
            </Button>
          ) : null}
        </div>

        {runsQuery.error ? (
          <p className="explorer-error" role="alert">
            {githubErrorMessage(runsQuery.error, "실행 기록을 불러오지 못했습니다.")}
          </p>
        ) : null}

        <PaginatedContent
          page={page}
          totalPages={runsQuery.data?.totalPages ?? 1}
          onChangePage={setPage}
          isFetching={runsQuery.isFetching}
          loadingMessage="실행 기록을 불러오는 중"
          ariaLabel="실행 기록 페이지"
        >
          {runsQuery.data ? (
            <RunList
              runs={runsQuery.data.items}
              emptyText={
                workflows.length === 0
                  ? "이 저장소에는 워크플로가 없습니다."
                  : "실행 기록이 없습니다."
              }
              onOpen={setOpenRunId}
            />
          ) : null}
        </PaginatedContent>
      </div>

      {selected ? (
        <RunWorkflowDialog
          key={selected.id}
          open={dispatchOpen}
          repo={repo}
          workflow={selected}
          defaultBranch={detail.defaultBranch}
          onClose={() => setDispatchOpen(false)}
        />
      ) : null}
    </div>
  );
}
