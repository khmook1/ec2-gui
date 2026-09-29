import { create } from "zustand";
import {
  DEFAULT_AUTO_REFRESH_INTERVAL,
  isAutoRefreshInterval,
  type AutoRefreshInterval,
} from "@/types/autoRefresh";

const STORAGE_KEY = "ec2-gui-auto-refresh";

function loadInterval(): AutoRefreshInterval {
  if (typeof localStorage === "undefined") {
    return DEFAULT_AUTO_REFRESH_INTERVAL;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isAutoRefreshInterval(raw)) {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_AUTO_REFRESH_INTERVAL;
}

function persistInterval(interval: AutoRefreshInterval): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, interval);
  } catch {
    // ignore storage errors
  }
}

interface AutoRefreshState {
  interval: AutoRefreshInterval;
  /** 자동·수동 새로고침마다 증가. 백그라운드 수집 데이터를 화면에 반영하는 시점 신호 */
  uiTick: number;
  setInterval: (interval: AutoRefreshInterval) => void;
  bumpUiTick: () => void;
}

export const useAutoRefreshStore = create<AutoRefreshState>((set) => ({
  interval: loadInterval(),
  uiTick: 0,
  setInterval: (interval) => {
    persistInterval(interval);
    set({ interval });
  },
  bumpUiTick: () => set((state) => ({ uiTick: state.uiTick + 1 })),
}));
