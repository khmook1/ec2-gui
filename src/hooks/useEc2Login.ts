import {
  markSkipAutoLogin,
  saveLoginCache,
} from "@/lib/loginCache";
import { closeAllSshShells, connectEc2, disconnectEc2 } from "@/services/tauri";
import { useConnectionStore } from "@/stores/connectionStore";
import { useDockerCacheStore } from "@/stores/dockerCacheStore";
import { useNavStore } from "@/stores/navStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type { Ec2Credentials } from "@/types/connection";

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

  return "EC2 접속에 실패했습니다.";
}

export function useEc2Login() {
  const status = useConnectionStore((state) => state.status);
  const connection = useConnectionStore((state) => state.connection);
  const errorMessage = useConnectionStore((state) => state.errorMessage);
  const setConnecting = useConnectionStore((state) => state.setConnecting);
  const setConnected = useConnectionStore((state) => state.setConnected);
  const setError = useConnectionStore((state) => state.setError);
  const reset = useConnectionStore((state) => state.reset);

  async function login(credentials: Ec2Credentials) {
    setConnecting();

    try {
      const result = await connectEc2(credentials);
      setConnected({
        host: result.host,
        username: result.username,
        port: result.port,
        authMethod: result.authMethod,
      });
      saveLoginCache(credentials);
      return true;
    } catch (error) {
      setError(getErrorMessage(error));
      return false;
    }
  }

  async function logout() {
    try {
      await closeAllSshShells();
    } catch {
      // Best-effort cleanup before disconnect.
    }

    try {
      await disconnectEc2();
    } catch {
      // Local session should reset even if remote disconnect fails.
    } finally {
      markSkipAutoLogin();
      useNavStore.getState().reset();
      useDockerCacheStore.getState().reset();
      useTerminalStore.getState().reset();
      reset();
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
