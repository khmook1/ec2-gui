import { create } from "zustand";

export interface TerminalSessionMeta {
  id: string;
  title: string;
}

export interface TerminalSnapshot {
  isOpen: boolean;
  height: number;
  sessions: TerminalSessionMeta[];
  activeSessionId: string | null;
  nextTabNumber: number;
}

interface TerminalState {
  isOpen: boolean;
  height: number;
  sessions: TerminalSessionMeta[];
  activeSessionId: string | null;
  nextTabNumber: number;
  setOpen: (isOpen: boolean) => void;
  toggle: () => void;
  setHeight: (height: number) => void;
  addSession: (id: string, title?: string) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  getSnapshot: () => TerminalSnapshot;
  hydrate: (snapshot: TerminalSnapshot) => void;
  reset: () => void;
}

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 120;

export function getTerminalMaxHeight(): number {
  if (typeof window === "undefined") {
    return 640;
  }
  return Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.75));
}

export function clampTerminalHeight(height: number): number {
  return Math.min(
    getTerminalMaxHeight(),
    Math.max(MIN_HEIGHT, Math.round(height)),
  );
}

const initialState = {
  isOpen: false,
  height: DEFAULT_HEIGHT,
  sessions: [] as TerminalSessionMeta[],
  activeSessionId: null as string | null,
  nextTabNumber: 1,
};

export const useTerminalStore = create<TerminalState>((set, get) => ({
  ...initialState,
  setOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setHeight: (height) => set({ height: clampTerminalHeight(height) }),
  addSession: (id, title) =>
    set((state) => {
      const tabNumber = state.nextTabNumber;
      const session: TerminalSessionMeta = {
        id,
        title: title ?? `터미널 ${tabNumber}`,
      };
      return {
        sessions: [...state.sessions, session],
        activeSessionId: id,
        nextTabNumber: tabNumber + 1,
        isOpen: true,
      };
    }),
  removeSession: (id) =>
    set((state) => {
      const sessions = state.sessions.filter((session) => session.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[sessions.length - 1]?.id ?? null)
          : state.activeSessionId;
      return {
        sessions,
        activeSessionId,
        isOpen: sessions.length > 0 ? state.isOpen : false,
      };
    }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  getSnapshot: () => {
    const state = get();
    return {
      isOpen: state.isOpen,
      height: state.height,
      sessions: state.sessions,
      activeSessionId: state.activeSessionId,
      nextTabNumber: state.nextTabNumber,
    };
  },
  hydrate: (snapshot) =>
    set({
      isOpen: snapshot.isOpen,
      height: clampTerminalHeight(snapshot.height),
      sessions: snapshot.sessions,
      activeSessionId: snapshot.activeSessionId,
      nextTabNumber: snapshot.nextTabNumber,
    }),
  reset: () => set({ ...initialState }),
}));

export const TERMINAL_MIN_HEIGHT = MIN_HEIGHT;
