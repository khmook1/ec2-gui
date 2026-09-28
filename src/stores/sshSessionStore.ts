import { create } from "zustand";
import type { SshConnectionInfo } from "@/types/connection";
import type { TerminalSnapshot } from "@/stores/terminalStore";

export type SshSessionTerminalSnapshot = TerminalSnapshot;

export interface SshAppSession {
  id: string;
  title: string;
  connection: SshConnectionInfo;
  terminal: SshSessionTerminalSnapshot;
}

interface SshSessionState {
  sessions: SshAppSession[];
  activeSessionId: string | null;
  isAddingSession: boolean;
  beginAddSession: () => void;
  cancelAddSession: () => void;
  upsertConnectedSession: (
    id: string,
    connection: SshConnectionInfo,
    memo?: string | null,
  ) => void;
  setActiveSessionId: (id: string) => void;
  updateSessionTerminal: (
    id: string,
    terminal: SshSessionTerminalSnapshot,
  ) => void;
  removeSession: (id: string) => string | null;
  reset: () => void;
}

function defaultTerminalSnapshot(): SshSessionTerminalSnapshot {
  return {
    isOpen: false,
    height: 280,
    sessions: [],
    activeSessionId: null,
    nextTabNumber: 1,
  };
}

function sessionTitle(
  connection: SshConnectionInfo,
  memo?: string | null,
): string {
  const trimmed = memo?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `${connection.username}@${connection.host}`;
}

export const useSshSessionStore = create<SshSessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isAddingSession: false,
  beginAddSession: () => set({ isAddingSession: true }),
  cancelAddSession: () => set({ isAddingSession: false }),
  upsertConnectedSession: (id, connection, memo) =>
    set((state) => {
      const title = sessionTitle(connection, memo);
      const existing = state.sessions.find((session) => session.id === id);
      if (existing) {
        return {
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  connection,
                  title,
                }
              : session,
          ),
          activeSessionId: id,
          isAddingSession: false,
        };
      }

      const session: SshAppSession = {
        id,
        title,
        connection,
        terminal: defaultTerminalSnapshot(),
      };

      return {
        sessions: [...state.sessions, session],
        activeSessionId: id,
        isAddingSession: false,
      };
    }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  updateSessionTerminal: (id, terminal) =>
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, terminal } : session,
      ),
    })),
  removeSession: (id) => {
    const { sessions, activeSessionId } = get();
    const nextSessions = sessions.filter((session) => session.id !== id);
    const nextActive =
      activeSessionId === id
        ? (nextSessions[nextSessions.length - 1]?.id ?? null)
        : activeSessionId;

    set({
      sessions: nextSessions,
      activeSessionId: nextActive,
      isAddingSession: false,
    });

    return nextActive;
  },
  reset: () =>
    set({
      sessions: [],
      activeSessionId: null,
      isAddingSession: false,
    }),
}));
