import { createElement } from "react";
import { getRoutePage } from "@/config/routeUtils";
import { useNavStore } from "@/stores/navStore";

export function RouteOutlet() {
  const activeId = useNavStore((state) => state.activeId);
  return createElement(getRoutePage(activeId), { key: activeId });
}
