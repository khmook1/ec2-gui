import { create } from "zustand";
import { listRemoteDockerContainers } from "@/services/tauri";
import type { Ec2ConnectionInfo } from "@/types/connection";
import type { DockerContainer } from "@/types/docker";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Docker 컨테이너 목록을 불러오지 못했습니다.";
}

export function getDockerSessionKey(connection: Ec2ConnectionInfo): string {
  return `${connection.host}:${connection.port}:${connection.username}`;
}

interface DockerCacheState {
  sessionKey: string | null;
  containers: DockerContainer[];
  hasCache: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  bindSession: (sessionKey: string | null) => void;
  reset: () => void;
  fetch: (options?: { force?: boolean }) => Promise<void>;
}

let inflightRequest: Promise<void> | null = null;

export const useDockerCacheStore = create<DockerCacheState>((set, get) => ({
  sessionKey: null,
  containers: [],
  hasCache: false,
  isFetching: false,
  errorMessage: null,

  bindSession: (sessionKey) => {
    const current = get().sessionKey;
    if (current === sessionKey) {
      return;
    }

    inflightRequest = null;
    set({
      sessionKey,
      containers: [],
      hasCache: false,
      isFetching: false,
      errorMessage: null,
    });
  },

  reset: () => {
    inflightRequest = null;
    set({
      sessionKey: null,
      containers: [],
      hasCache: false,
      isFetching: false,
      errorMessage: null,
    });
  },

  fetch: async ({ force = false } = {}) => {
    const { sessionKey, hasCache } = get();

    if (!sessionKey) {
      return;
    }

    if (hasCache && !force) {
      return;
    }

    if (inflightRequest && !force) {
      await inflightRequest;
      return;
    }

    const run = async () => {
      const hadCache = get().hasCache;
      set({
        isFetching: true,
        ...(force ? { errorMessage: null } : {}),
      });

      try {
        const containers = await listRemoteDockerContainers();
        set({
          containers,
          hasCache: true,
          errorMessage: null,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        if (hadCache) {
          set({ errorMessage: message });
        } else {
          set({
            containers: [],
            hasCache: false,
            errorMessage: message,
          });
        }
      } finally {
        set({ isFetching: false });
        inflightRequest = null;
      }
    };

    inflightRequest = run();
    await inflightRequest;
  },
}));

export function prefetchDockerContainers(): void {
  void useDockerCacheStore.getState().fetch();
}
