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
  GitHubActionsNavIcon,
  GitHubNavIcon,
  GitHubReposNavIcon,
  SettingsAiNavIcon,
  SettingsGeneralNavIcon,
  SettingsNavIcon,
} from "@/components/icons/NavIcons";

export const ROUTE_ID = {
  dashboard: "dashboard",
  fileExplorer: "file-explorer",
  docker: "docker",
  dockerContainers: "docker-containers",
  dockerImages: "docker-images",
  dockerNetworks: "docker-networks",
  dockerVolumes: "docker-volumes",
  dockerSystem: "docker-system",
  github: "github",
  githubRepos: "github-repos",
  githubActiveRuns: "github-active-runs",
  githubRepo: "github-repo",
  settings: "settings",
  settingsGeneral: "settings-general",
  settingsAi: "settings-ai",
} as const;

export type RouteId = (typeof ROUTE_ID)[keyof typeof ROUTE_ID];

/** 해당 조건일 때 사이드바 항목을 비활성화 (항목은 표시) */
export type RouteHiddenCondition = "docker-unavailable";

export type RouteIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** 페이지 컴포넌트는 `routePages.ts`에서 매핑한다 (store → Route → 페이지 순환 import 방지). */
export interface AppRoute {
  id: RouteId;
  /** 브라우저/앱 URL path */
  path: string;
  label: string;
  headerTitle: string;
  icon: RouteIcon;
  /** 사이드바 메뉴에 표시 여부 */
  showInSidebar?: boolean;
  hiddenWhen?: RouteHiddenCondition;
  /** 하위 메뉴 (예: Docker) */
  children?: readonly AppRoute[];
  /** 그룹 전용 항목: 클릭 시 이동할 기본 자식 */
  defaultChildId?: RouteId;
  /** 뒤로가기 시 히스토리와 관계없이 돌아갈 화면 (예: 상세 → 목록) */
  backTo?: RouteId;
}

export const ROUTES: readonly AppRoute[] = [
  {
    id: ROUTE_ID.dashboard,
    path: "/",
    label: "대시보드",
    headerTitle: "대시보드",
    icon: DashboardNavIcon,
    showInSidebar: true,
  },
  {
    id: ROUTE_ID.fileExplorer,
    path: "/files",
    label: "파일 탐색기",
    headerTitle: "파일",
    icon: FileExplorerNavIcon,
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
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerImages,
        path: "/docker/images",
        label: "이미지",
        headerTitle: "Docker · 이미지",
        icon: DockerImagesNavIcon,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerNetworks,
        path: "/docker/networks",
        label: "네트워크",
        headerTitle: "Docker · 네트워크",
        icon: DockerNetworksNavIcon,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerVolumes,
        path: "/docker/volumes",
        label: "볼륨",
        headerTitle: "Docker · 볼륨",
        icon: DockerVolumesNavIcon,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
      {
        id: ROUTE_ID.dockerSystem,
        path: "/docker/system",
        label: "시스템",
        headerTitle: "Docker · 시스템",
        icon: DockerSystemNavIcon,
        showInSidebar: true,
        hiddenWhen: "docker-unavailable",
      },
    ],
  },
  {
    id: ROUTE_ID.github,
    path: "/github",
    label: "GitHub",
    headerTitle: "GitHub",
    icon: GitHubNavIcon,
    showInSidebar: true,
    defaultChildId: ROUTE_ID.githubRepos,
    children: [
      {
        id: ROUTE_ID.githubRepos,
        path: "/github/repos",
        label: "저장소",
        headerTitle: "GitHub · 저장소",
        icon: GitHubReposNavIcon,
        showInSidebar: true,
      },
      {
        id: ROUTE_ID.githubActiveRuns,
        path: "/github/active-runs",
        label: "진행중인 액션",
        headerTitle: "GitHub · 진행중인 액션",
        icon: GitHubActionsNavIcon,
        showInSidebar: true,
      },
      {
        id: ROUTE_ID.githubRepo,
        path: "/github/repo",
        label: "저장소 상세",
        headerTitle: "GitHub · 저장소 상세",
        icon: GitHubNavIcon,
        showInSidebar: false,
        backTo: ROUTE_ID.githubRepos,
      },
    ],
  },
  {
    id: ROUTE_ID.settings,
    path: "/settings",
    label: "설정",
    headerTitle: "설정",
    icon: SettingsNavIcon,
    showInSidebar: true,
    defaultChildId: ROUTE_ID.settingsGeneral,
    children: [
      {
        id: ROUTE_ID.settingsGeneral,
        path: "/settings/general",
        label: "기본 설정",
        headerTitle: "설정 · 기본 설정",
        icon: SettingsGeneralNavIcon,
        showInSidebar: true,
      },
      {
        id: ROUTE_ID.settingsAi,
        path: "/settings/ai",
        label: "AI 설정",
        headerTitle: "설정 · AI 설정",
        icon: SettingsAiNavIcon,
        showInSidebar: true,
      },
    ],
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
