import type { ComponentType, SVGProps } from "react";
import {
  DashboardNavIcon,
  DockerContainersNavIcon,
  DockerImagesNavIcon,
  DockerNavIcon,
  DockerNetworksNavIcon,
  DockerSystemNavIcon,
  DockerVolumesNavIcon,
  FileExplorerNavIcon,
  SettingsNavIcon,
} from "@/components/icons/NavIcons";
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

export const ROUTE_ID = {
  dashboard: "dashboard",
  fileExplorer: "file-explorer",
  docker: "docker",
  dockerContainers: "docker-containers",
  dockerImages: "docker-images",
  dockerNetworks: "docker-networks",
  dockerVolumes: "docker-volumes",
  dockerSystem: "docker-system",
  settings: "settings",
} as const;

export type RouteId = (typeof ROUTE_ID)[keyof typeof ROUTE_ID];

/** 해당 조건일 때 사이드바 항목을 비활성화 (항목은 표시) */
export type RouteHiddenCondition = "docker-unavailable";

export type RouteIcon = ComponentType<SVGProps<SVGSVGElement>>;
export type RoutePage = ComponentType;

export interface AppRoute {
  id: RouteId;
  /** 브라우저/앱 URL path */
  path: string;
  label: string;
  headerTitle: string;
  icon: RouteIcon;
  /** 그룹 전용 항목은 생략 가능 (클릭 시 defaultChildId로 이동) */
  component?: RoutePage;
  /** 사이드바 메뉴에 표시 여부 */
  showInSidebar?: boolean;
  hiddenWhen?: RouteHiddenCondition;
  /** 하위 메뉴 (예: Docker) */
  children?: readonly AppRoute[];
  /** 그룹 클릭 시 이동할 기본 자식 */
  defaultChildId?: RouteId;
}

export const ROUTES: readonly AppRoute[] = [
  {
    id: ROUTE_ID.dashboard,
    path: "/",
    label: "대시보드",
    headerTitle: "대시보드",
    icon: DashboardNavIcon,
    component: DashboardPage,
    showInSidebar: true,
  },
  {
    id: ROUTE_ID.fileExplorer,
    path: "/files",
    label: "파일 탐색기",
    headerTitle: "파일",
    icon: FileExplorerNavIcon,
    component: FileExplorerPage,
    showInSidebar: true,
  },
  {
    id: ROUTE_ID.docker,
    path: "/docker",
    label: "Docker",
    headerTitle: "Docker",
    icon: DockerNavIcon,
    showInSidebar: true,
    hiddenWhen: "docker-unavailable",
    defaultChildId: ROUTE_ID.dockerContainers,
    children: [
      {
        id: ROUTE_ID.dockerContainers,
        path: "/docker/containers",
        label: "컨테이너",
        headerTitle: "Docker · 컨테이너",
        icon: DockerContainersNavIcon,
        component: DockerContainersPage,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerImages,
        path: "/docker/images",
        label: "이미지",
        headerTitle: "Docker · 이미지",
        icon: DockerImagesNavIcon,
        component: DockerImagesPage,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerNetworks,
        path: "/docker/networks",
        label: "네트워크",
        headerTitle: "Docker · 네트워크",
        icon: DockerNetworksNavIcon,
        component: DockerNetworksPage,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerVolumes,
        path: "/docker/volumes",
        label: "볼륨",
        headerTitle: "Docker · 볼륨",
        icon: DockerVolumesNavIcon,
        component: DockerVolumesPage,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerSystem,
        path: "/docker/system",
        label: "시스템",
        headerTitle: "Docker · 시스템",
        icon: DockerSystemNavIcon,
        component: DockerSystemPage,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
    ],
  },
  {
    id: ROUTE_ID.settings,
    path: "/settings",
    label: "설정",
    headerTitle: "설정",
    icon: SettingsNavIcon,
    component: SettingsPage,
    showInSidebar: true,
  },
] as const;

export const DEFAULT_ROUTE_ID: RouteId = ROUTE_ID.dashboard;

/** Docker 계열 route id */
export const DOCKER_ROUTE_IDS: readonly RouteId[] = [
  ROUTE_ID.docker,
  ROUTE_ID.dockerContainers,
  ROUTE_ID.dockerImages,
  ROUTE_ID.dockerNetworks,
  ROUTE_ID.dockerVolumes,
  ROUTE_ID.dockerSystem,
];
