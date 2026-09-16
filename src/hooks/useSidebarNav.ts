import { useEffect, useMemo } from "react";
import { checkRemoteDocker } from "@/services/tauri";
import { prefetchDockerContainers } from "@/stores/dockerCacheStore";
import {
  getSidebarNavItems,
  isSidebarNavItemEnabled,
  NAV_VIEW,
  type SidebarNavItem,
} from "@/config/sidebarNav";
import { useConnectionStore } from "@/stores/connectionStore";
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
    if (dockerInstalled === false && activeId === NAV_VIEW.docker) {
      setActiveId(NAV_VIEW.fileExplorer);
    }
  }, [activeId, dockerInstalled, setActiveId]);

  const items: SidebarNavItem[] = useMemo(() => getSidebarNavItems(), []);

  function isItemEnabled(item: SidebarNavItem): boolean {
    return isSidebarNavItemEnabled(item, { dockerInstalled });
  }

  return {
    items,
    activeId,
    setActiveId,
    isItemEnabled,
  };
}
