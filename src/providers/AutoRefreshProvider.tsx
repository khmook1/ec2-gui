import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useConnectionStore } from "@/stores/connectionStore";

interface AutoRefreshProviderProps {
  children: ReactNode;
}

export function AutoRefreshProvider({ children }: AutoRefreshProviderProps) {
  const queryClient = useQueryClient();
  const { intervalMs } = useAutoRefresh();
  const isConnected = useConnectionStore(
    (state) => state.status === "connected",
  );

  useEffect(() => {
    if (!intervalMs || !isConnected) {
      return;
    }

    const timerId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void queryClient.refetchQueries({ type: "active" });
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [intervalMs, isConnected, queryClient]);

  return children;
}
