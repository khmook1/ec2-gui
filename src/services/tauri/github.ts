import { Channel, invoke } from "@tauri-apps/api/core";
import type { AiConnectionInput, AiStreamEvent } from "@/services/tauri/ai";
import type {
  GitHubActiveRuns,
  GitHubBranch,
  GitHubComment,
  GitHubCommitDetail,
  GitHubContentEntry,
  GitHubFile,
  GitHubIssue,
  GitHubIssueState,
  GitHubJob,
  GitHubLanguage,
  GitHubMergeMethod,
  GitHubMergeResult,
  GitHubPage,
  GitHubPull,
  GitHubRepoDetail,
  GitHubRepoPage,
  GitHubRepoQuery,
  GitHubRepoUpdate,
  GitHubViewer,
  GitHubWorkflow,
  GitHubWorkflowDispatch,
  GitHubWorkflowRun,
  RecentCommits,
  WeeklyReport,
  WeeklyReportStatus,
} from "@/types/github";

export async function openExternalUrl(url: string): Promise<void> {
  return invoke<void>("open_external_url", { url });
}

export async function getGitHubViewer(): Promise<GitHubViewer> {
  return invoke<GitHubViewer>("get_github_viewer");
}

export async function listGitHubRepos(
  query: GitHubRepoQuery,
): Promise<GitHubRepoPage> {
  return invoke<GitHubRepoPage>("list_github_repos", { query });
}

export async function getGitHubRepo(repo: string): Promise<GitHubRepoDetail> {
  return invoke<GitHubRepoDetail>("get_github_repo", { repo });
}

export async function getGitHubRepoLanguages(
  repo: string,
): Promise<GitHubLanguage[]> {
  return invoke<GitHubLanguage[]>("get_github_repo_languages", { repo });
}

/** README가 없으면 `null` */
export async function getGitHubReadme(
  repo: string,
  gitRef: string | null,
): Promise<string | null> {
  return invoke<string | null>("get_github_readme", { repo, gitRef });
}

export async function listGitHubContents(
  repo: string,
  path: string,
  gitRef: string | null,
): Promise<GitHubContentEntry[]> {
  return invoke<GitHubContentEntry[]>("list_github_contents", {
    repo,
    path,
    gitRef,
  });
}

export async function getGitHubFile(
  repo: string,
  path: string,
  gitRef: string | null,
): Promise<GitHubFile> {
  return invoke<GitHubFile>("get_github_file", { repo, path, gitRef });
}

export async function updateGitHubRepo(
  repo: string,
  update: GitHubRepoUpdate,
): Promise<GitHubRepoDetail> {
  return invoke<GitHubRepoDetail>("update_github_repo", { repo, update });
}

export async function replaceGitHubTopics(
  repo: string,
  names: string[],
): Promise<string[]> {
  return invoke<string[]>("replace_github_topics", { repo, names });
}

export async function listGitHubBranches(
  repo: string,
  page: number,
  perPage: number,
): Promise<GitHubPage<GitHubBranch>> {
  return invoke<GitHubPage<GitHubBranch>>("list_github_branches", {
    repo,
    page,
    perPage,
  });
}

export async function createGitHubBranch(
  repo: string,
  name: string,
  from: string,
): Promise<GitHubBranch> {
  return invoke<GitHubBranch>("create_github_branch", { repo, name, from });
}

export async function deleteGitHubBranch(
  repo: string,
  name: string,
): Promise<void> {
  return invoke<void>("delete_github_branch", { repo, name });
}

export async function listGitHubIssues(
  repo: string,
  state: GitHubIssueState,
  page: number,
  perPage: number,
): Promise<GitHubPage<GitHubIssue>> {
  return invoke<GitHubPage<GitHubIssue>>("list_github_issues", {
    repo,
    state,
    page,
    perPage,
  });
}

export async function getGitHubIssue(
  repo: string,
  number: number,
): Promise<GitHubIssue> {
  return invoke<GitHubIssue>("get_github_issue", { repo, number });
}

export async function listGitHubIssueComments(
  repo: string,
  number: number,
  page: number,
  perPage: number,
): Promise<GitHubPage<GitHubComment>> {
  return invoke<GitHubPage<GitHubComment>>("list_github_issue_comments", {
    repo,
    number,
    page,
    perPage,
  });
}

export async function createGitHubIssue(
  repo: string,
  title: string,
  body: string,
): Promise<GitHubIssue> {
  return invoke<GitHubIssue>("create_github_issue", { repo, title, body });
}

export async function setGitHubIssueState(
  repo: string,
  number: number,
  state: GitHubIssueState,
): Promise<GitHubIssue> {
  return invoke<GitHubIssue>("set_github_issue_state", {
    repo,
    number,
    state,
  });
}

export async function createGitHubIssueComment(
  repo: string,
  number: number,
  body: string,
): Promise<GitHubComment> {
  return invoke<GitHubComment>("create_github_issue_comment", {
    repo,
    number,
    body,
  });
}

export async function listGitHubPulls(
  repo: string,
  state: GitHubIssueState,
  page: number,
  perPage: number,
): Promise<GitHubPage<GitHubPull>> {
  return invoke<GitHubPage<GitHubPull>>("list_github_pulls", {
    repo,
    state,
    page,
    perPage,
  });
}

export async function getGitHubPull(
  repo: string,
  number: number,
): Promise<GitHubPull> {
  return invoke<GitHubPull>("get_github_pull", { repo, number });
}

export async function mergeGitHubPull(
  repo: string,
  number: number,
  method: GitHubMergeMethod,
  commitTitle: string | null,
): Promise<GitHubMergeResult> {
  return invoke<GitHubMergeResult>("merge_github_pull", {
    repo,
    number,
    method,
    commitTitle,
  });
}

export async function setGitHubPullState(
  repo: string,
  number: number,
  state: GitHubIssueState,
): Promise<GitHubPull> {
  return invoke<GitHubPull>("set_github_pull_state", { repo, number, state });
}

export async function listGitHubWorkflows(
  repo: string,
): Promise<GitHubWorkflow[]> {
  return invoke<GitHubWorkflow[]>("list_github_workflows", { repo });
}

export async function listGitHubWorkflowRuns(
  repo: string,
  workflowId: number | null,
  page: number,
  perPage: number,
): Promise<GitHubPage<GitHubWorkflowRun>> {
  return invoke<GitHubPage<GitHubWorkflowRun>>("list_github_workflow_runs", {
    repo,
    workflowId,
    page,
    perPage,
  });
}

export async function listGitHubActiveRuns(): Promise<GitHubActiveRuns> {
  return invoke<GitHubActiveRuns>("list_github_active_runs");
}

export async function getGitHubWorkflowRun(
  repo: string,
  runId: number,
): Promise<GitHubWorkflowRun> {
  return invoke<GitHubWorkflowRun>("get_github_workflow_run", { repo, runId });
}

export async function listGitHubRunJobs(
  repo: string,
  runId: number,
): Promise<GitHubJob[]> {
  return invoke<GitHubJob[]>("list_github_run_jobs", { repo, runId });
}

export async function getGitHubJobLogs(
  repo: string,
  jobId: number,
): Promise<string> {
  return invoke<string>("get_github_job_logs", { repo, jobId });
}

export async function getGitHubWorkflowDispatch(
  repo: string,
  path: string,
  gitRef: string | null,
): Promise<GitHubWorkflowDispatch> {
  return invoke<GitHubWorkflowDispatch>("get_github_workflow_dispatch", {
    repo,
    path,
    gitRef,
  });
}

export async function dispatchGitHubWorkflow(
  repo: string,
  workflowId: number,
  gitRef: string,
  inputs: Record<string, string | boolean>,
): Promise<void> {
  return invoke<void>("dispatch_github_workflow", {
    repo,
    workflowId,
    gitRef,
    inputs,
  });
}

export async function rerunGitHubWorkflowRun(
  repo: string,
  runId: number,
  failedOnly: boolean,
): Promise<void> {
  return invoke<void>("rerun_github_workflow_run", { repo, runId, failedOnly });
}

export async function cancelGitHubWorkflowRun(
  repo: string,
  runId: number,
): Promise<void> {
  return invoke<void>("cancel_github_workflow_run", { repo, runId });
}

export async function getWeeklyReportStatus(): Promise<WeeklyReportStatus> {
  return invoke<WeeklyReportStatus>("get_weekly_report_status");
}

export async function listWeeklyReports(): Promise<WeeklyReport[]> {
  return invoke<WeeklyReport[]>("list_weekly_reports");
}

export async function getGitHubCommit(
  repo: string,
  sha: string,
): Promise<GitHubCommitDetail> {
  return invoke<GitHubCommitDetail>("get_github_commit", { repo, sha });
}

export async function listRecentCommits(): Promise<RecentCommits> {
  return invoke<RecentCommits>("list_recent_commits");
}

/** 취소는 `cancelAiChat`으로 한다. */
export async function generateWeeklyReport(
  { provider, binaryPath }: AiConnectionInput,
  onEvent: (event: AiStreamEvent) => void,
): Promise<WeeklyReport> {
  const channel = new Channel<AiStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<WeeklyReport>("generate_weekly_report", {
    provider,
    binaryPath,
    onEvent: channel,
  });
}
