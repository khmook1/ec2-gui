import {
  markSkipAutoLogin,
  saveLoginCache,
} from "@/lib/loginCache";
import {
  useConnectSshMutation,
  useDisconnectSshMutation,
} from "@/hooks/query";
import { useToast } from "@/providers/ToastProvider";
import { useConnectionStore } from "@/stores/connectionStore";
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

  const connectMutation = useConnectSshMutation();
  const disconnectMutation = useDisconnectSshMutation();

  async function login(
    credentials: SshCredentials,
    options?: { memo?: string },
  ) {
    setConnecting();

    try {
      const result = await connectMutation.mutateAsync(credentials);
      setConnected({
        host: result.host,
        username: result.username,
        port: result.port,
        authMethod: result.authMethod,
      });
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
    markSkipAutoLogin();

    try {
      await disconnectMutation.mutateAsync();
    } finally {
      useNavStore.getState().reset();
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
    isConnecting: status === "connecting" || connectMutation.isPending,
    login,
    logout,
  };
}
