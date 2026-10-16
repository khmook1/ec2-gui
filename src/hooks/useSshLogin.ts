import { markSkipAutoLogin, saveLoginCache } from "@/lib/loginCache";
import { useConnectSshMutation, useDisconnectSshMutation } from "@/hooks/query";
import { useToast } from "@/providers/ToastProvider";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNavStore } from "@/stores/navStore";
import { useSshSessionStore } from "@/stores/sshSessionStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { disconnectSshSession, setActiveSshSession } from "@/services/tauri";
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

/** 같은 IPv4 주소의 앞자리 0 표기도 동일한 서버로 취급한다. */
function normalizeHost(host: string): string {
  const trimmed = host.trim();
  const parts = trimmed.split(".");
  if (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  ) {
    return parts.map((part) => String(Number(part))).join(".");
  }
  return trimmed.toLowerCase();
}

const connectingHosts = new Set<string>();

function persistActiveSessionSnapshot() {
  const activeId = useSshSessionStore.getState().activeSessionId;
  if (!activeId) {
    return;
  }
  const sessionStore = useSshSessionStore.getState();
  sessionStore.updateSessionTerminal(
    activeId,
    useTerminalStore.getState().getSnapshot(),
  );
  sessionStore.updateSessionNavigation(
    activeId,
    useNavStore.getState().getSnapshot(),
  );
}

export async function activateSshSession(
  sessionId: string,
  saveCurrent = true,
): Promise<void> {
  const session = useSshSessionStore
    .getState()
    .sessions.find((item) => item.id === sessionId);
  if (!session) {
    return;
  }

  if (saveCurrent) {
    persistActiveSessionSnapshot();
  }

  await setActiveSshSession(sessionId);

  const currentSession =
    useSshSessionStore
      .getState()
      .sessions.find((item) => item.id === sessionId) ?? session;
  useSshSessionStore.getState().setActiveSessionId(sessionId);
  useConnectionStore.getState().mirrorConnection({
    ...currentSession.connection,
    connectionId: currentSession.id,
  });
  useTerminalStore.getState().hydrate(currentSession.terminal);
  useNavStore.getState().restore(currentSession.navigation);
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
    const host = normalizeHost(credentials.host);
    const existing = useSshSessionStore
      .getState()
      .sessions.find(
        (session) => normalizeHost(session.connection.host) === host,
      );
    if (existing) {
      try {
        await activateSshSession(existing.id);
        useSshSessionStore.getState().cancelAddSession();
        toast.info(`${existing.connection.host}의 열린 세션으로 이동했습니다.`);
        return true;
      } catch (error) {
        toast.error(getErrorMessage(error));
        return false;
      }
    }

    if (connectingHosts.has(host)) {
      toast.info(`${credentials.host.trim()}에 연결 중입니다.`);
      return false;
    }
    connectingHosts.add(host);
    persistActiveSessionSnapshot();
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
    } finally {
      connectingHosts.delete(host);
    }
  }

  async function closeSession(sessionId: string) {
    persistActiveSessionSnapshot();
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
      await activateSshSession(nextActive, false);
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
    persistActiveSessionSnapshot();
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
