import type { ComponentType, SVGProps } from "react";
import {
  DashboardNavIcon,
  DockerNavIcon,
  FileExplorerNavIcon,
  SettingsNavIcon,
} from "@/components/icons/NavIcons";

export const NAV_VIEW = {
  dashboard: "dashboard",
  fileExplorer: "file-explorer",
  docker: "docker",
  settings: "settings",
} as const;

export type NavViewId = (typeof NAV_VIEW)[keyof typeof NAV_VIEW];

/** 해당 조건일 때 사이드바 항목을 비활성화 (항목은 표시) */
export type SidebarNavHiddenCondition = "docker-unavailable";

export type SidebarNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface SidebarNavItem {
  id: NavViewId;
  label: string;
  headerTitle: string;
  icon: SidebarNavIcon;
  hiddenWhen?: SidebarNavHiddenCondition;
}

export const SIDEBAR_NAV_ITEMS: readonly SidebarNavItem[] = [
  {
    id: NAV_VIEW.dashboard,
    label: "대시보드",
    headerTitle: "대시보드",
    icon: DashboardNavIcon,
  },
  {
    id: NAV_VIEW.fileExplorer,
    label: "파일 탐색기",
    headerTitle: "파일",
    icon: FileExplorerNavIcon,
  },
  {
    id: NAV_VIEW.docker,
    label: "Docker",
    headerTitle: "Docker",
    icon: DockerNavIcon,
    hiddenWhen: "docker-unavailable",
  },
  {
    id: NAV_VIEW.settings,
    label: "설정",
    headerTitle: "설정",
    icon: SettingsNavIcon,
  },
];

export interface SidebarNavVisibilityContext {
  dockerInstalled: boolean | null;
}

export function isSidebarNavItemEnabled(
  item: SidebarNavItem,
  context: SidebarNavVisibilityContext,
): boolean {
  if (item.hiddenWhen === "docker-unavailable") {
    return context.dockerInstalled === true;
  }
  return true;
}

/** 사이드바에 표시할 전체 메뉴 (`SIDEBAR_NAV_ITEMS`와 동일) */
export function getSidebarNavItems(): SidebarNavItem[] {
  return [...SIDEBAR_NAV_ITEMS];
}

export function getNavItemById(id: NavViewId): SidebarNavItem | undefined {
  return SIDEBAR_NAV_ITEMS.find((item) => item.id === id);
}
