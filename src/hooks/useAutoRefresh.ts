import { useAutoRefreshStore } from "@/stores/autoRefreshStore";
import {
  AUTO_REFRESH_OPTIONS,
  getAutoRefreshMs,
  type AutoRefreshInterval,
} from "@/types/autoRefresh";

export function useAutoRefresh() {
  const interval = useAutoRefreshStore((state) => state.interval);
  const setInterval = useAutoRefreshStore((state) => state.setInterval);
  const intervalMs = getAutoRefreshMs(interval);

  return {
    interval,
    intervalMs,
    options: AUTO_REFRESH_OPTIONS,
    setInterval: (value: AutoRefreshInterval) => setInterval(value),
  };
}
