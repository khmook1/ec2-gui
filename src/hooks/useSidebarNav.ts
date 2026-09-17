import { useEffect, useMemo } from "react";
import { ROUTE_ID, type AppRoute } from "@/config/Route";
import {
  getSidebarRoutes,
  isDockerRouteId,
  isRouteEnabled,
} from "@/config/routeUtils";
import {
  useDockerInstalledQuery,
  usePrefetchDockerContainers,
} from "@/hooks/query";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNavStore } from "@/stores/navStore";

export function useSidebarNav() {
  const isConnected = useConnectionStore(
    (state) => state.status === "connected",
  );
  const activeId = useNavStore((state) => state.activeId);
  const dockerInstalled = useNavStore((state) => state.dockerInstalled);
  const setActiveId = useNavStore((state) => state.setActiveId);
  const setDockerInstalled = useNavStore((state) => state.setDockerInstalled);

  const installedQuery = useDockerInstalledQuery();
  const prefetchContainers = usePrefetchDockerContainers();

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    if (installedQuery.isSuccess) {
      setDockerInstalled(installedQuery.data);
      if (installedQuery.data) {
        prefetchContainers();
      }
    } else if (installedQuery.isError) {
      setDockerInstalled(false);
    }
  }, [
    installedQuery.data,
    installedQuery.isError,
    installedQuery.isSuccess,
    isConnected,
    prefetchContainers,
    setDockerInstalled,
  ]);

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
