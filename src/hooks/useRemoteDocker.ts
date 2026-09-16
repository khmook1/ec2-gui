import { useCallback, useEffect, useState } from "react";
import { runRemoteDockerContainerAction } from "@/services/tauri/docker";
import { useDockerCacheStore } from "@/stores/dockerCacheStore";
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
  const sessionKey = useDockerCacheStore((state) => state.sessionKey);
  const containers = useDockerCacheStore((state) => state.containers);
  const hasCache = useDockerCacheStore((state) => state.hasCache);
  const isFetching = useDockerCacheStore((state) => state.isFetching);
  const errorMessage = useDockerCacheStore((state) => state.errorMessage);
  const fetch = useDockerCacheStore((state) => state.fetch);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!sessionKey) {
      return;
    }
    void fetch();
  }, [fetch, sessionKey]);

  const refresh = useCallback(() => fetch({ force: true }), [fetch]);

  const runAction = useCallback(
    async (containerId: string, action: DockerContainerAction) => {
      setIsActing(true);
      try {
        const output = await runRemoteDockerContainerAction(containerId, action);
        const trimmed = output.trim();
        if (trimmed) {
          toast.success(trimmed, { mono: true });
        } else if (action.startsWith("nginx-")) {
          toast.success("nginx 명령을 실행했습니다.");
        } else {
          toast.success("명령을 실행했습니다.");
        }
        await fetch({ force: true });
        return output;
      } catch (error) {
        toast.error(getErrorMessage(error));
        throw error;
      } finally {
        setIsActing(false);
      }
    },
    [fetch, toast],
  );

  return {
    containers,
    hasCache,
    isFetching,
    isActing,
    errorMessage,
    refresh,
    runAction,
  };
}
