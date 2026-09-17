import { useCallback } from "react";
import {
  useDockerContainerActionMutation,
  useDockerContainersQuery,
} from "@/hooks/query";
import { useToast } from "@/providers/ToastProvider";
import type { DockerContainerAction } from "@/types/docker";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Docker 명령을 실행하지 못했습니다.";
}

export function useRemoteDocker() {
  const toast = useToast();
  const {
    data,
    isFetching,
    isSuccess,
    isError,
    error,
    refetch,
  } = useDockerContainersQuery();
  const actionMutation = useDockerContainerActionMutation();

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const runAction = useCallback(
    async (containerId: string, action: DockerContainerAction) => {
      try {
        const output = await actionMutation.mutateAsync({
          containerId,
          action,
        });
        const trimmed = output.trim();
        if (trimmed) {
          toast.success(trimmed, { mono: true });
        } else if (action.startsWith("nginx-")) {
          toast.success("nginx 명령을 실행했습니다.");
        } else {
          toast.success("명령을 실행했습니다.");
        }
        return output;
      } catch (err) {
        toast.error(getErrorMessage(err));
        throw err;
      }
    },
    [actionMutation, toast],
  );

  return {
    containers: data ?? [],
    hasCache: isSuccess || (isFetching && data != null),
    isFetching,
    isActing: actionMutation.isPending,
    errorMessage:
      error instanceof Error
        ? error.message
        : isError
          ? "Docker 컨테이너 목록을 불러오지 못했습니다."
          : null,
    refresh,
    runAction,
  };
}
