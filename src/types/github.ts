import type { AiProvider } from "@/types/settings";

export interface GitHubViewer {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GitHubRepo {
  fullName: string;
  name: string;
  owner: string;
  /** GitHub owner 타입: "User" | "Organization" */
  ownerType: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  description: string | null;
  language: string | null;
  stargazers: number;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt: string | null;
  updatedAt: string | null;
}

/** GitHub `/user/repos`의 `affiliation` 값 */
export type GitHubAffiliation =
  | "owner,collaborator,organization_member"
  | "owner"
  | "collaborator"
  | "organization_member";

export type GitHubVisibility = "all" | "public" | "private";

export interface GitHubRepoQuery {
  page: number;
  perPage: number;
  affiliation: GitHubAffiliation;
  visibility: GitHubVisibility;
  /** 비어 있지 않으면 GitHub 검색 API(`/search/repositories`)로 조회 */
  keyword: string;
}

export interface GitHubRepoPage {
  repos: GitHubRepo[];
  page: number;
  perPage: number;
  totalPages: number;
  /** 검색 모드에서만 존재 */
  totalCount: number | null;
}

export const GITHUB_AFFILIATION_OPTIONS: {
  value: GitHubAffiliation;
  label: string;
}[] = [
  { value: "owner,collaborator,organization_member", label: "전체" },
  { value: "owner", label: "내 소유" },
  { value: "collaborator", label: "협업" },
  { value: "organization_member", label: "조직" },
];

export const GITHUB_VISIBILITY_OPTIONS: {
  value: GitHubVisibility;
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

export const GITHUB_PER_PAGE_OPTIONS = [30, 50, 100] as const;

/** 상세 API 공통 페이지 응답 */
export interface GitHubPage<T> {
  items: T[];
  page: number;
  perPage: number;
  totalPages: number;
}

export interface GitHubUser {
  login: string;
  avatarUrl: string;
}

export interface GitHubPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

export interface GitHubRepoDetail {
  fullName: string;
  name: string;
  owner: string;
  ownerAvatarUrl: string;
  private: boolean;
  visibility: string;
  fork: boolean;
  archived: boolean;
  description: string | null;
  homepage: string | null;
  topics: string[];
  language: string | null;
  stargazers: number;
  watchers: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  htmlUrl: string;
  license: string | null;
  hasIssues: boolean;
  createdAt: string | null;
  pushedAt: string | null;
  permissions: GitHubPermissions;
}

export interface GitHubLanguage {
  name: string;
  bytes: number;
}

export type GitHubContentKind = "file" | "dir" | "symlink" | "submodule";

export interface GitHubContentEntry {
  name: string;
  path: string;
  kind: GitHubContentKind;
  size: number;
  sha: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  size: number;
  sha: string;
  /** 텍스트 파일일 때만 존재 */
  content: string | null;
  binary: boolean;
  /** GitHub contents API는 1MB 초과 파일 내용을 주지 않는다 */
  tooLarge: boolean;
}

export interface GitHubRepoUpdate {
  description?: string;
  homepage?: string;
  private?: boolean;
  hasIssues?: boolean;
  archived?: boolean;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export type GitHubIssueState = "open" | "closed";

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: GitHubIssueState;
  user: GitHubUser;
  comments: number;
  labels: GitHubLabel[];
  /** 상세 조회에서만 존재 */
  bodyHtml: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  isPullRequest: boolean;
}

export interface GitHubComment {
  id: number;
  user: GitHubUser;
  bodyHtml: string | null;
  createdAt: string;
}

export interface GitHubPull {
  number: number;
  title: string;
  state: GitHubIssueState;
  draft: boolean;
  merged: boolean;
  user: GitHubUser;
  headRef: string;
  baseRef: string;
  bodyHtml: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  /** 이하 상세 조회에서만 존재 */
  mergeable: boolean | null;
  mergeableState: string | null;
  comments: number | null;
  commits: number | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}

export type GitHubMergeMethod = "merge" | "squash" | "rebase";

export interface GitHubMergeResult {
  merged: boolean;
  message: string;
}

export const GITHUB_MERGE_METHOD_OPTIONS: {
  value: GitHubMergeMethod;
  label: string;
}[] = [
  { value: "merge", label: "Merge commit" },
  { value: "squash", label: "Squash and merge" },
  { value: "rebase", label: "Rebase and merge" },
];

/** 이슈·PR·브랜치 목록 페이지 크기 */
export const GITHUB_DETAIL_PER_PAGE = 30;

export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  /** "active" | "disabled_manually" | "disabled_inactivity" 등 */
  state: string;
  htmlUrl: string;
}

export type GitHubRunStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "requested"
  | "pending";

export interface GitHubWorkflowRun {
  id: number;
  workflowId: number;
  name: string;
  displayTitle: string;
  runNumber: number;
  runAttempt: number;
  event: string;
  status: GitHubRunStatus;
  /** completed일 때만: success | failure | cancelled | skipped | timed_out 등 */
  conclusion: string | null;
  headBranch: string | null;
  headSha: string;
  actor: GitHubUser;
  createdAt: string;
  updatedAt: string;
  runStartedAt: string | null;
  htmlUrl: string;
}

export interface GitHubActiveRun extends GitHubWorkflowRun {
  /** `owner/name` */
  repo: string;
}

export interface GitHubActiveRuns {
  runs: GitHubActiveRun[];
  scannedRepos: number;
  /** Actions 비활성·권한 부족 등으로 조회하지 못한 저장소 */
  failedRepos: string[];
}

export interface GitHubJobStep {
  number: number;
  name: string;
  status: GitHubRunStatus;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GitHubJob {
  id: number;
  name: string;
  status: GitHubRunStatus;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string | null;
  steps: GitHubJobStep[];
}

export interface GitHubWorkflowInput {
  name: string;
  description: string | null;
  required: boolean;
  default: string | null;
  /** "string" | "boolean" | "choice" | "number" | "environment" */
  kind: string;
  options: string[];
}

export interface GitHubWorkflowDispatch {
  /** `on: workflow_dispatch` 트리거가 있어야 수동 실행할 수 있다 */
  dispatchable: boolean;
  inputs: GitHubWorkflowInput[];
}

export interface WeeklyCommit {
  /** `owner/name` */
  repo: string;
  sha: string;
  message: string;
  date: string;
  url: string;
  /** 커밋 이메일이 GitHub 계정과 연결되지 않았으면 null */
  authorLogin: string | null;
  authorAvatarUrl: string | null;
}

export type GitHubCommitFileStatus =
  | "added"
  | "removed"
  | "modified"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export interface GitHubCommitFile {
  filename: string;
  previousFilename: string | null;
  status: GitHubCommitFileStatus;
  additions: number;
  deletions: number;
  /** 바이너리이거나 diff가 너무 크면 null */
  patch: string | null;
}

export interface GitHubCommitDetail {
  sha: string;
  additions: number;
  deletions: number;
  files: GitHubCommitFile[];
}

export interface RecentCommits {
  periodStart: string;
  periodEnd: string;
  commits: WeeklyCommit[];
}

export interface WeeklyReport {
  /** ISO 주차 (`2026-W42`) */
  weekKey: string;
  periodStart: string;
  periodEnd: string;
  commitCount: number;
  repos: string[];
  content: string;
  createdAt: string;
  provider: AiProvider;
  /** 커밋 목록 저장 이전에 만든 리포트는 비어 있다 */
  commits: WeeklyCommit[];
}

export interface WeeklyReportStatus {
  weekKey: string;
  /** 이번 주 리포트가 있으면 다시 생성할 때 덮어쓴다 */
  generated: boolean;
}

export const GITHUB_RUNS_PER_PAGE = 25;
