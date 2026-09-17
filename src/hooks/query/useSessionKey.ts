import { getSessionKey } from "@/lib/sessionKey";
import { useConnectionStore } from "@/stores/connectionStore";

/** 현재 SSH 접속의 세션 키. 미접속이면 null. */
export function useSessionKey(): string | null {
  const connection = useConnectionStore((state) => state.connection);
  if (!connection) {
    return null;
  }
  return getSessionKey(connection);
}
