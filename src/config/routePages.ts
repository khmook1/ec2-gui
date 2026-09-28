import type { ComponentType } from "react";
import { DEFAULT_ROUTE_ID, ROUTE_ID, type RouteId } from "@/config/Route";
import { resolveNavigableRouteId } from "@/config/routeUtils";
import { DashboardPage } from "@/pages/Dashboard";
import {
  DockerContainersPage,
  DockerImagesPage,
  DockerNetworksPage,
  DockerSystemPage,
  DockerVolumesPage,
} from "@/pages/docker";
import { FileExplorerPage } from "@/pages/FileExplorer";
import { SettingsPage } from "@/pages/Settings";

export type RoutePage = ComponentType;

/** 그룹 전용 라우트(`docker`)는 defaultChildId로 해석되므로 매핑하지 않는다. */
const ROUTE_PAGES: Partial<Record<RouteId, RoutePage>> = {
  [ROUTE_ID.dashboard]: DashboardPage,
  [ROUTE_ID.fileExplorer]: FileExplorerPage,
  [ROUTE_ID.dockerContainers]: DockerContainersPage,
  [ROUTE_ID.dockerImages]: DockerImagesPage,
  [ROUTE_ID.dockerNetworks]: DockerNetworksPage,
  [ROUTE_ID.dockerVolumes]: DockerVolumesPage,
  [ROUTE_ID.dockerSystem]: DockerSystemPage,
  [ROUTE_ID.settings]: SettingsPage,
};

export function getRoutePage(id: RouteId): RoutePage {
  return (
    ROUTE_PAGES[resolveNavigableRouteId(id)] ?? ROUTE_PAGES[DEFAULT_ROUTE_ID]!
  );
}
