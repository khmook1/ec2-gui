import { create } from "zustand";
import { DEFAULT_ROUTE_ID, type RouteId } from "@/config/Route";
import {
  getRouteById,
  resolveNavigableRouteId,
  syncBrowserPath,
} from "@/config/routeUtils";

export interface NavSnapshot {
  activeId: RouteId;
  /** 뒤로 갈 수 있는 이전 화면들 (오래된 → 최근) */
  history: RouteId[];
  /** 앞으로 갈 수 있는 화면들 (가까운 → 먼) */
  forward: RouteId[];
  dockerInstalled: boolean | null;
}

interface NavState extends NavSnapshot {
  setActiveId: (id: RouteId) => void;
  /** URL 등에서 초기 화면을 복원할 때 히스토리 없이 설정 */
  hydrateActiveId: (id: RouteId) => void;
  goBack: () => boolean;
  goForward: () => boolean;
  setDockerInstalled: (installed: boolean) => void;
  getSnapshot: () => NavSnapshot;
  restore: (snapshot: NavSnapshot) => void;
  reset: () => void;
}

export function defaultNavSnapshot(): NavSnapshot {
  return {
    activeId: DEFAULT_ROUTE_ID,
    history: [],
    forward: [],
    dockerInstalled: null,
  };
}

function applyActiveId(activeId: RouteId): void {
  syncBrowserPath(activeId);
}

export const useNavStore = create<NavState>((set, get) => ({
  activeId: DEFAULT_ROUTE_ID,
  history: [],
  forward: [],
  dockerInstalled: null,
  setActiveId: (id) =>
    set((state) => {
      const activeId = resolveNavigableRouteId(id);
      if (state.activeId === activeId) {
        return state;
      }
      applyActiveId(activeId);
      return {
        activeId,
        history: [...state.history, state.activeId],
        forward: [],
      };
    }),
  hydrateActiveId: (id) =>
    set((state) => {
      const activeId = resolveNavigableRouteId(id);
      if (state.activeId === activeId) {
        return state;
      }
      applyActiveId(activeId);
      return { activeId };
    }),
  goBack: () => {
    const { history, activeId, forward } = get();
    const backTo = getRouteById(activeId)?.backTo;
    if (backTo && history[history.length - 1] !== backTo) {
      applyActiveId(backTo);
      set({ activeId: backTo, forward: [activeId, ...forward] });
      return true;
    }
    if (history.length === 0) {
      return false;
    }
    const nextHistory = [...history];
    const previous = nextHistory.pop();
    if (!previous) {
      return false;
    }
    applyActiveId(previous);
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
    applyActiveId(next);
    set({
      activeId: next,
      history: [...history, activeId],
      forward: nextForward,
    });
    return true;
  },
  setDockerInstalled: (dockerInstalled) => set({ dockerInstalled }),
  getSnapshot: () => {
    const { activeId, history, forward, dockerInstalled } = get();
    return {
      activeId,
      history: [...history],
      forward: [...forward],
      dockerInstalled,
    };
  },
  restore: (snapshot) => {
    applyActiveId(snapshot.activeId);
    set({
      activeId: snapshot.activeId,
      history: [...snapshot.history],
      forward: [...snapshot.forward],
      dockerInstalled: snapshot.dockerInstalled,
    });
  },
  reset: () => {
    applyActiveId(DEFAULT_ROUTE_ID);
    set(defaultNavSnapshot());
  },
}));
