import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  closeAllSshShells,
  connectSsh,
  disconnectSsh,
  disconnectSshSession,
} from "@/services/tauri";
import type { SshCredentials } from "@/types/connection";

export function useConnectSshMutation() {
  return useMutation({
    mutationFn: (credentials: SshCredentials) => connectSsh(credentials),
  });
}

export function useDisconnectSshMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await closeAllSshShells();
      } catch {
        // Best-effort cleanup before disconnect.
      }
      try {
        await disconnectSsh();
      } catch {
        // Local session should reset even if remote disconnect fails.
      }
    },
    onSettled: () => {
      queryClient.clear();
    },
  });
}

export function useDisconnectSshSessionMutation() {
  return useMutation({
    mutationFn: (connectionId: string) => disconnectSshSession(connectionId),
  });
}
