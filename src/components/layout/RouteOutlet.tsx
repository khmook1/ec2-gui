import { createElement } from "react";
import { getRoutePage } from "@/config/routePages";
import { useNavStore } from "@/stores/navStore";

export function RouteOutlet() {
  const activeId = useNavStore((state) => state.activeId);
  return createElement(getRoutePage(activeId), { key: activeId });
}
