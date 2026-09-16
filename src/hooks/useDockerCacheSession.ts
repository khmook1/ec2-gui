import { useEffect } from "react";
import {
  getDockerSessionKey,
  useDockerCacheStore,
} from "@/stores/dockerCacheStore";
import { useConnectionStore } from "@/stores/connectionStore";

/** 접속 세션과 Docker PS 캐시 키를 동기화합니다. */
export function useDockerCacheSession() {
  const connection = useConnectionStore((state) => state.connection);
  const bindSession = useDockerCacheStore((state) => state.bindSession);

  useEffect(() => {
    if (!connection) {
      bindSession(null);
      return;
    }

    bindSession(getDockerSessionKey(connection));
  }, [bindSession, connection]);
}
