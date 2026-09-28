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
  setInterval: (interval: AutoRefreshInterval) => void;
}

export const useAutoRefreshStore = create<AutoRefreshState>((set) => ({
  interval: loadInterval(),
  setInterval: (interval) => {
    persistInterval(interval);
    set({ interval });
  },
}));
