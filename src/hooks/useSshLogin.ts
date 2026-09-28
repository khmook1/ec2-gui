import {
  markSkipAutoLogin,
  saveLoginCache,
} from "@/lib/loginCache";
import { useConnectSshMutation, useDisconnectSshMutation } from "@/hooks/query";
import { useToast } from "@/providers/ToastProvider";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNavStore } from "@/stores/navStore";
import { useSshSessionStore } from "@/stores/sshSessionStore";
import { useTerminalStore } from "@/stores/terminalStore";
import {
  disconnectSshSession,
  setActiveSshSession,
} from "@/services/tauri";
import type { SshAuthMethod, SshCredentials } from "@/types/connection";

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

function persistActiveTerminalSnapshot() {
  const activeId = useSshSessionStore.getState().activeSessionId;
  if (!activeId) {
    return;
  }
  useSshSessionStore
    .getState()
    .updateSessionTerminal(activeId, useTerminalStore.getState().getSnapshot());
}

export async function activateSshSession(sessionId: string): Promise<void> {
  const session = useSshSessionStore
    .getState()
    .sessions.find((item) => item.id === sessionId);
  if (!session) {
    return;
  }

  persistActiveTerminalSnapshot();

  await setActiveSshSession(sessionId);

  useSshSessionStore.getState().setActiveSessionId(sessionId);
  useConnectionStore.getState().mirrorConnection({
    ...session.connection,
    connectionId: session.id,
  });
  useTerminalStore.getState().hydrate(session.terminal);
  useNavStore.getState().reset();
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
    persistActiveTerminalSnapshot();
    setConnecting();

    try {
      const result = await connectMutation.mutateAsync(credentials);
      const authMethod = result.authMethod as SshAuthMethod;
      const connectionInfo = {
        host: result.host,
        username: result.username,
        port: result.port,
        authMethod,
        connectionId: result.connectionId,
      };

      useSshSessionStore
        .getState()
        .upsertConnectedSession(
          result.connectionId,
          connectionInfo,
          options?.memo,
        );
      setConnected(connectionInfo);
      useTerminalStore.getState().reset();
      useNavStore.getState().reset();
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

  async function closeSession(sessionId: string) {
    persistActiveTerminalSnapshot();
    const wasActive =
      useSshSessionStore.getState().activeSessionId === sessionId;

    try {
      await disconnectSshSession(sessionId);
    } catch {
      // Local session should reset even if remote disconnect fails.
    }

    const nextActive = useSshSessionStore.getState().removeSession(sessionId);

    if (!nextActive) {
      markSkipAutoLogin();
      useNavStore.getState().reset();
      useTerminalStore.getState().reset();
      useSshSessionStore.getState().reset();
      reset();
      toast.info("연결을 해제했습니다.");
      return;
    }

    if (wasActive) {
      await activateSshSession(nextActive);
    }
    toast.info("세션을 닫았습니다.");
  }

  async function logout() {
    const activeId = useSshSessionStore.getState().activeSessionId;
    if (activeId) {
      await closeSession(activeId);
      return;
    }

    markSkipAutoLogin();

    try {
      await disconnectMutation.mutateAsync();
    } finally {
      useNavStore.getState().reset();
      useTerminalStore.getState().reset();
      useSshSessionStore.getState().reset();
      reset();
      toast.info("연결을 해제했습니다.");
    }
  }

  function beginAddSession() {
    persistActiveTerminalSnapshot();
    useSshSessionStore.getState().beginAddSession();
  }

  function cancelAddSession() {
    useSshSessionStore.getState().cancelAddSession();
    const activeId = useSshSessionStore.getState().activeSessionId;
    const session = useSshSessionStore
      .getState()
      .sessions.find((item) => item.id === activeId);
    if (session) {
      useConnectionStore.getState().mirrorConnection({
        ...session.connection,
        connectionId: session.id,
      });
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
    closeSession,
    beginAddSession,
    cancelAddSession,
  };
}
