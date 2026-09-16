import { create } from "zustand";

export interface TerminalSessionMeta {
  id: string;
  title: string;
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
  reset: () => void;
}

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 120;

export function getTerminalMaxHeight(): number {
  if (typeof window === "undefined") {
    return 640;
  }
  // 헤더·콘텐츠 최소 영역을 남기고 최대 약 75%까지
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

export const useTerminalStore = create<TerminalState>((set) => ({
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
  reset: () => set({ ...initialState }),
}));

export const TERMINAL_MIN_HEIGHT = MIN_HEIGHT;
