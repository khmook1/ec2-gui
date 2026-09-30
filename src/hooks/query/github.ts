import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import {
  getGitHubFile,
  getGitHubIssue,
  getGitHubPull,
  getGitHubReadme,
  getGitHubRepo,
  getGitHubRepoLanguages,
  getGitHubViewer,
  listGitHubBranches,
  listGitHubContents,
  listGitHubIssueComments,
  listGitHubIssues,
  listGitHubPulls,
  listGitHubRepos,
} from "@/services/tauri";
import {
  GITHUB_DETAIL_PER_PAGE,
  type GitHubIssueState,
  type GitHubRepoQuery,
} from "@/types/github";

const DETAIL_STALE_MS = 60 * 1000;

export function useGitHubViewerQuery() {
  return useQuery({
    queryKey: queryKeys.githubViewer,
    queryFn: getGitHubViewer,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

export function useGitHubReposQuery(query: GitHubRepoQuery) {
  return useQuery({
    queryKey: queryKeys.githubRepos(query),
    queryFn: () => listGitHubRepos(query),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGitHubRepoQuery(repo: string | null) {
  return useQuery({
    queryKey: queryKeys.githubRepo(repo ?? ""),
    queryFn: () => getGitHubRepo(repo!),
    enabled: repo != null,
    staleTime: DETAIL_STALE_MS,
    retry: false,
  });
}

export function useGitHubLanguagesQuery(repo: string) {
  return useQuery({
    queryKey: queryKeys.githubLanguages(repo),
    queryFn: () => getGitHubRepoLanguages(repo),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useGitHubReadmeQuery(repo: string, gitRef: string | null) {
  return useQuery({
    queryKey: queryKeys.githubReadme(repo, gitRef),
    queryFn: () => getGitHubReadme(repo, gitRef),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useGitHubContentsQuery(
  repo: string,
  path: string,
  gitRef: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.githubContents(repo, path, gitRef),
    queryFn: () => listGitHubContents(repo, path, gitRef),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGitHubFileQuery(
  repo: string,
  path: string | null,
  gitRef: string | null,
) {
  return useQuery({
    queryKey: queryKeys.githubFile(repo, path ?? "", gitRef),
    queryFn: () => getGitHubFile(repo, path!, gitRef),
    enabled: path != null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useGitHubBranchesQuery(
  repo: string,
  page: number,
  perPage = GITHUB_DETAIL_PER_PAGE,
) {
  return useQuery({
    queryKey: queryKeys.githubBranches(repo, page, perPage),
    queryFn: () => listGitHubBranches(repo, page, perPage),
    staleTime: DETAIL_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGitHubIssuesQuery(
  repo: string,
  state: GitHubIssueState,
  page: number,
) {
  return useQuery({
    queryKey: queryKeys.githubIssues(repo, state, page),
    queryFn: () => listGitHubIssues(repo, state, page, GITHUB_DETAIL_PER_PAGE),
    staleTime: DETAIL_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGitHubIssueQuery(repo: string, number: number) {
  return useQuery({
    queryKey: queryKeys.githubIssue(repo, number),
    queryFn: () => getGitHubIssue(repo, number),
    staleTime: DETAIL_STALE_MS,
    retry: false,
  });
}

export function useGitHubCommentsQuery(
  repo: string,
  number: number,
  page: number,
) {
  return useQuery({
    queryKey: queryKeys.githubComments(repo, number, page),
    queryFn: () =>
      listGitHubIssueComments(repo, number, page, GITHUB_DETAIL_PER_PAGE),
    staleTime: DETAIL_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGitHubPullsQuery(
  repo: string,
  state: GitHubIssueState,
  page: number,
) {
  return useQuery({
    queryKey: queryKeys.githubPulls(repo, state, page),
    queryFn: () => listGitHubPulls(repo, state, page, GITHUB_DETAIL_PER_PAGE),
    staleTime: DETAIL_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGitHubPullQuery(repo: string, number: number) {
  return useQuery({
    queryKey: queryKeys.githubPull(repo, number),
    queryFn: () => getGitHubPull(repo, number),
    staleTime: DETAIL_STALE_MS,
    retry: false,
  });
}
