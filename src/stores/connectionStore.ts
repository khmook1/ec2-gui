import { create } from "zustand";
import type { ConnectionStatus, SshConnectionInfo } from "@/types/connection";

interface ConnectionState {
  status: ConnectionStatus;
  connection: SshConnectionInfo | null;
  errorMessage: string | null;
  setConnecting: () => void;
  setConnected: (connection: SshConnectionInfo) => void;
  setError: (message: string) => void;
  reset: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  connection: null,
  errorMessage: null,
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
    }),
  setError: (message) =>
    set({
      status: "error",
      errorMessage: message,
    }),
  reset: () =>
    set({
      status: "disconnected",
      connection: null,
      errorMessage: null,
    }),
}));
