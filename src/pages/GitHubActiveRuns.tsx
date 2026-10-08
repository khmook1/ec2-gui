import { useState } from "react";
import { AsyncDataLoader } from "@/components/common/AsyncDataLoader";
import { Button } from "@/components/common/Button";
import { IconButton } from "@/components/common/IconButton";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { PageToolbar } from "@/components/common/PageToolbar";
import { WorkflowRunDetail } from "@/components/github/WorkflowRunDetail";
import { RunList } from "@/components/github/atoms/RunList";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import { useGitHubActiveRunsQuery, useGitHubRepoQuery } from "@/hooks/query";
import { githubErrorMessage } from "@/lib/github";
import "@/components/github/css/github.css";
import "@/components/github/css/github-repo.css";

interface OpenRun {
  repo: string;
  runId: number;
}

export function GitHubActiveRunsPage() {
  const [openRun, setOpenRun] = useState<OpenRun | null>(null);
  const activeQuery = useGitHubActiveRunsQuery();
  const data = activeQuery.data ?? null;

  if (openRun) {
    return (
      <section className="github-repo">
        <div className="github-repo__content">
          <ActiveRunDetail
            repo={openRun.repo}
            runId={openRun.runId}
            onBack={() => setOpenRun(null)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="explorer github-page">
      <PageToolbar
        actions={
          <IconButton
            tone="success"
            tooltip="새로고침"
            aria-label="새로고침"
            disabled={activeQuery.isFetching}
            onClick={() => void activeQuery.refetch()}
          >
            <RefreshIcon />
          </IconButton>
        }
        bodyClassName="github-page__toolbar"
      >
        <p className="page-toolbar__hint">
          최근 push된 저장소에서 대기·실행 중인 워크플로를 30초마다 갱신합니다.
        </p>
      </PageToolbar>

      <AsyncDataLoader
        isLoading={activeQuery.isLoading}
        hasData={data != null}
        message="진행중인 액션을 가져옵니다"
      >
        {activeQuery.error ? (
          <p className="explorer-error" role="alert">
            {githubErrorMessage(activeQuery.error, "진행중인 액션을 불러오지 못했습니다.")}
          </p>
        ) : null}

        {data ? (
          <div className="github-tab-list">
            <RunList
              runs={data.runs}
              emptyText="진행중인 액션이 없습니다."
              onOpen={(run) => setOpenRun({ repo: run.repo, runId: run.id })}
            />
          </div>
        ) : null}

        <footer className="explorer-statusbar">
          <span>
            {data
              ? `저장소 ${data.scannedRepos}개 확인 · 진행중 ${data.runs.length}개`
              : ""}
          </span>
          {activeQuery.isFetching ? (
            <span>갱신 중…</span>
          ) : data && data.failedRepos.length > 0 ? (
            <span title={data.failedRepos.join("\n")}>
              {data.failedRepos.length}개 저장소 조회 실패
            </span>
          ) : null}
        </footer>
      </AsyncDataLoader>
    </section>
  );
}

function ActiveRunDetail({
  repo,
  runId,
  onBack,
}: OpenRun & { onBack: () => void }) {
  const repoQuery = useGitHubRepoQuery(repo);

  if (repoQuery.data) {
    return (
      <WorkflowRunDetail detail={repoQuery.data} runId={runId} onBack={onBack} />
    );
  }
  if (repoQuery.error) {
    return (
      <>
        <p className="explorer-error" role="alert">
          {githubErrorMessage(repoQuery.error, "저장소 정보를 불러오지 못했습니다.")}
        </p>
        <Button onClick={onBack}>목록으로</Button>
      </>
    );
  }
  return <LoadingIndicator message="저장소 정보를 가져옵니다" />;
}
