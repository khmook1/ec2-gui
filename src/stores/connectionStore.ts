import { create } from "zustand";
import type { ConnectionStatus, SshConnectionInfo } from "@/types/connection";

interface ConnectionState {
  status: ConnectionStatus;
  connection: SshConnectionInfo | null;
  errorMessage: string | null;
  /** 로그인 → 대시보드 전환 시에만 true. 서버 정보 최초 연동 오버레이용 */
  showServerSyncOverlay: boolean;
  setConnecting: () => void;
  setConnected: (connection: SshConnectionInfo) => void;
  setError: (message: string) => void;
  completeServerSync: () => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  connection: null,
  errorMessage: null,
  showServerSyncOverlay: false,
  setConnecting: () =>
    set({
      status: "connecting",
      errorMessage: null,
    }),
  setConnected: (connection) =>
    set({
      status: "connected",
      connection,
      errorMessage: null,
      showServerSyncOverlay: true,
    }),
  setError: (message) =>
    set({
      status: "error",
      errorMessage: message,
    }),
  completeServerSync: () => set({ showServerSyncOverlay: false }),
  reset: () =>
    set({
      status: "disconnected",
      connection: null,
      errorMessage: null,
      showServerSyncOverlay: false,
    }),
}));
