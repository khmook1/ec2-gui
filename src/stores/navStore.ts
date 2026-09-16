import { create } from "zustand";
import { NAV_VIEW, type NavViewId } from "@/config/sidebarNav";

interface NavState {
  activeId: NavViewId;
  /** 뒤로 갈 수 있는 이전 화면들 (오래된 → 최근) */
  history: NavViewId[];
  /** 앞으로 갈 수 있는 화면들 (가까운 → 먼) */
  forward: NavViewId[];
  dockerInstalled: boolean | null;
  setActiveId: (id: NavViewId) => void;
  goBack: () => boolean;
  goForward: () => boolean;
  setDockerInstalled: (installed: boolean) => void;
  reset: () => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  activeId: NAV_VIEW.dashboard,
  history: [],
  forward: [],
  dockerInstalled: null,
  setActiveId: (activeId) =>
    set((state) => {
      if (state.activeId === activeId) {
        return state;
      }
      return {
        activeId,
        history: [...state.history, state.activeId],
        forward: [],
      };
    }),
  goBack: () => {
    const { history, activeId, forward } = get();
    if (history.length === 0) {
      return false;
    }
    const nextHistory = [...history];
    const previous = nextHistory.pop();
    if (!previous) {
      return false;
    }
    set({
      activeId: previous,
      history: nextHistory,
      forward: [activeId, ...forward],
    });
    return true;
  },
  goForward: () => {
    const { history, activeId, forward } = get();
    if (forward.length === 0) {
      return false;
    }
    const nextForward = [...forward];
    const next = nextForward.shift();
    if (!next) {
      return false;
    }
    set({
      activeId: next,
      history: [...history, activeId],
      forward: nextForward,
    });
    return true;
  },
  setDockerInstalled: (dockerInstalled) => set({ dockerInstalled }),
  reset: () =>
    set({
      activeId: NAV_VIEW.dashboard,
      history: [],
      forward: [],
      dockerInstalled: null,
    }),
}));
