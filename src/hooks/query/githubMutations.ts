import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import { githubErrorMessage } from "@/lib/github";
import { useToast } from "@/providers/ToastProvider";
import {
  createGitHubBranch,
  createGitHubIssue,
  createGitHubIssueComment,
  deleteGitHubBranch,
  getGitHubRepo,
  mergeGitHubPull,
  replaceGitHubTopics,
  setGitHubIssueState,
  setGitHubPullState,
  updateGitHubRepo,
} from "@/services/tauri";
import type {
  GitHubIssueState,
  GitHubMergeMethod,
  GitHubRepoDetail,
  GitHubRepoUpdate,
} from "@/types/github";

const STATE_LABEL: Record<GitHubIssueState, string> = {
  open: "다시 열었습니다",
  closed: "닫았습니다",
};

export interface UpdateGitHubRepoInput {
  update: GitHubRepoUpdate;
  /** 지정하면 토픽 전체를 교체한다 */
  topics?: string[];
}

export function useUpdateGitHubRepoMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ update, topics }: UpdateGitHubRepoInput) => {
      const hasUpdate = Object.keys(update).length > 0;
      if (!hasUpdate && topics === undefined) {
        throw new Error("변경할 항목이 없습니다.");
      }
      const detail = hasUpdate
        ? await updateGitHubRepo(repo, update)
        : await getGitHubRepo(repo);
      if (topics === undefined) {
        return detail;
      }
      const names = await replaceGitHubTopics(repo, topics);
      return { ...detail, topics: names } satisfies GitHubRepoDetail;
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.githubRepo(repo), detail);
      void queryClient.invalidateQueries({ queryKey: ["github", "repos"] });
      toast.success("저장소 설정을 저장했습니다.");
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "저장소 설정을 저장하지 못했습니다."));
    },
  });
}

export function useCreateGitHubBranchMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ name, from }: { name: string; from: string }) =>
      createGitHubBranch(repo, name, from),
    onSuccess: (branch) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubBranchesScope(repo),
      });
      toast.success(`${branch.name} 브랜치를 만들었습니다.`);
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "브랜치를 만들지 못했습니다."));
    },
  });
}

export function useDeleteGitHubBranchMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (name: string) => deleteGitHubBranch(repo, name),
    onSuccess: (_result, name) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubBranchesScope(repo),
      });
      toast.success(`${name} 브랜치를 삭제했습니다.`);
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "브랜치를 삭제하지 못했습니다."));
    },
  });
}

export function useCreateGitHubIssueMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) =>
      createGitHubIssue(repo, title, body),
    onSuccess: (issue) => {
      queryClient.setQueryData(queryKeys.githubIssue(repo, issue.number), issue);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubIssuesScope(repo),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubRepo(repo),
      });
      toast.success(`#${issue.number} 이슈를 만들었습니다.`);
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "이슈를 만들지 못했습니다."));
    },
  });
}

export function useSetGitHubIssueStateMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      number,
      state,
    }: {
      number: number;
      state: GitHubIssueState;
    }) => setGitHubIssueState(repo, number, state),
    onSuccess: (issue) => {
      queryClient.setQueryData(queryKeys.githubIssue(repo, issue.number), issue);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubIssuesScope(repo),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubRepo(repo),
      });
      toast.success(`#${issue.number} 이슈를 ${STATE_LABEL[issue.state]}.`);
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "이슈 상태를 바꾸지 못했습니다."));
    },
  });
}

export function useCreateGitHubCommentMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ number, body }: { number: number; body: string }) =>
      createGitHubIssueComment(repo, number, body),
    onSuccess: (_comment, { number }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubCommentsScope(repo, number),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubIssue(repo, number),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubPull(repo, number),
      });
      toast.success("댓글을 남겼습니다.");
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "댓글을 남기지 못했습니다."));
    },
  });
}

export function useMergeGitHubPullMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      number,
      method,
      commitTitle,
    }: {
      number: number;
      method: GitHubMergeMethod;
      commitTitle: string | null;
    }) => mergeGitHubPull(repo, number, method, commitTitle),
    onSuccess: (result, { number }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubPullsScope(repo),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubBranchesScope(repo),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubRepo(repo),
      });
      if (result.merged) {
        toast.success(`#${number} PR을 머지했습니다.`);
      } else {
        toast.error(result.message || `#${number} PR을 머지하지 못했습니다.`);
      }
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "PR을 머지하지 못했습니다."));
    },
  });
}

export function useSetGitHubPullStateMutation(repo: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      number,
      state,
    }: {
      number: number;
      state: GitHubIssueState;
    }) => setGitHubPullState(repo, number, state),
    onSuccess: (pull) => {
      queryClient.setQueryData(queryKeys.githubPull(repo, pull.number), pull);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.githubPullsScope(repo),
      });
      toast.success(`#${pull.number} PR을 ${STATE_LABEL[pull.state]}.`);
    },
    onError: (error) => {
      toast.error(githubErrorMessage(error, "PR 상태를 바꾸지 못했습니다."));
    },
  });
}
