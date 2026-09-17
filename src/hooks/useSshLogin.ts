import {
  markSkipAutoLogin,
  saveLoginCache,
} from "@/lib/loginCache";
import { useToast } from "@/providers/ToastProvider";
import { closeAllSshShells, connectSsh, disconnectSsh } from "@/services/tauri";
import { useConnectionStore } from "@/stores/connectionStore";
import { useDockerCacheStore } from "@/stores/dockerCacheStore";
import { useNavStore } from "@/stores/navStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type { SshCredentials } from "@/types/connection";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "SSH 접속에 실패했습니다.";
}

export function useSshLogin() {
  const toast = useToast();
  const status = useConnectionStore((state) => state.status);
  const connection = useConnectionStore((state) => state.connection);
  const errorMessage = useConnectionStore((state) => state.errorMessage);
  const setConnecting = useConnectionStore((state) => state.setConnecting);
  const setConnected = useConnectionStore((state) => state.setConnected);
  const setError = useConnectionStore((state) => state.setError);
  const reset = useConnectionStore((state) => state.reset);

  async function login(credentials: SshCredentials, options?: { memo?: string }) {
    setConnecting();

    try {
      const result = await connectSsh(credentials);
      setConnected({
        host: result.host,
        username: result.username,
        port: result.port,
        authMethod: result.authMethod,
      });
      // 접속 기록 + 자동 접속 캐시 저장, skip 플래그 해제
      saveLoginCache(credentials, options?.memo);
      toast.success(`${result.username}@${result.host}에 연결되었습니다.`);
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      toast.error(message);
      return false;
    }
  }

  async function logout() {
    // 자동 접속 캐시만 지우고 접속 기록은 유지
    markSkipAutoLogin();

    try {
      await closeAllSshShells();
    } catch {
      // Best-effort cleanup before disconnect.
    }

    try {
      await disconnectSsh();
    } catch {
      // Local session should reset even if remote disconnect fails.
    } finally {
      useNavStore.getState().reset();
      useDockerCacheStore.getState().reset();
      useTerminalStore.getState().reset();
      reset();
      toast.info("연결을 해제했습니다.");
    }
  }

  return {
    status,
    connection,
    errorMessage,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    login,
    logout,
  };
}
