import { useEffect, useMemo } from "react";
import { ROUTE_ID, type AppRoute } from "@/config/Route";
import {
  getSidebarRoutes,
  isDockerRouteId,
  isRouteEnabled,
} from "@/config/routeUtils";
import { checkRemoteDocker } from "@/services/tauri";
import { useConnectionStore } from "@/stores/connectionStore";
import { prefetchDockerContainers } from "@/stores/dockerCacheStore";
import { useNavStore } from "@/stores/navStore";

export function useSidebarNav() {
  const isConnected = useConnectionStore((state) => state.status === "connected");
  const activeId = useNavStore((state) => state.activeId);
  const dockerInstalled = useNavStore((state) => state.dockerInstalled);
  const setActiveId = useNavStore((state) => state.setActiveId);
  const setDockerInstalled = useNavStore((state) => state.setDockerInstalled);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    let cancelled = false;

    void checkRemoteDocker()
      .then((installed) => {
        if (!cancelled) {
          setDockerInstalled(installed);
          if (installed) {
            prefetchDockerContainers();
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDockerInstalled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, setDockerInstalled]);

  useEffect(() => {
    if (dockerInstalled === false && isDockerRouteId(activeId)) {
      setActiveId(ROUTE_ID.fileExplorer);
    }
  }, [activeId, dockerInstalled, setActiveId]);

  const items: AppRoute[] = useMemo(() => getSidebarRoutes(), []);

  function isItemEnabled(item: AppRoute): boolean {
    return isRouteEnabled(item, { dockerInstalled });
  }

  return {
    items,
    activeId,
    setActiveId,
    isItemEnabled,
  };
}
