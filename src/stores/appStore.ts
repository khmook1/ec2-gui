import { create } from "zustand";
import type { AppInfo, AppRuntimeStatus } from "@/types/app";

interface AppState {
  status: AppRuntimeStatus;
  appInfo: AppInfo | null;
  errorMessage: string | null;
  setStatus: (status: AppRuntimeStatus) => void;
  setAppInfo: (appInfo: AppInfo) => void;
  setError: (message: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: "idle",
  appInfo: null,
  errorMessage: null,
  setStatus: (status) => set({ status, errorMessage: null }),
  setAppInfo: (appInfo) =>
    set({
      appInfo,
      status: "ready",
      errorMessage: null,
    }),
  setError: (message) =>
    set({
      status: "error",
      errorMessage: message,
    }),
}));
