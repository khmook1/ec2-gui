import { useEffect } from "react";
import {
  getBrowserRoutePath,
  getRouteByPath,
  repairDocumentUrl,
  syncBrowserPath,
} from "@/config/routeUtils";
import { useNavStore } from "@/stores/navStore";

/** 앱 URL(hash)과 navStore activeId를 맞춘다. 연결 후 메인 화면에서 한 번만 사용한다. */
export function useRouteUrlSync() {
  const hydrateActiveId = useNavStore((state) => state.hydrateActiveId);

  useEffect(() => {
    repairDocumentUrl();

    const matched = getRouteByPath(getBrowserRoutePath());
    if (matched) {
      hydrateActiveId(matched.id);
    } else {
      syncBrowserPath(useNavStore.getState().activeId);
    }

    function handleHashChange() {
      repairDocumentUrl();
      const route = getRouteByPath(getBrowserRoutePath());
      if (route) {
        hydrateActiveId(route.id);
      }
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [hydrateActiveId]);
}
