import {
  DEFAULT_ROUTE_ID,
  DOCKER_ROUTE_IDS,
  ROUTES,
  type AppRoute,
  type RouteId,
  type RoutePage,
} from "@/config/Route";

export interface RouteVisibilityContext {
  dockerInstalled: boolean | null;
}

/** 부모·자식을 펼친 전체 라우트 목록 */
export function getFlatRoutes(): AppRoute[] {
  const flat: AppRoute[] = [];
  for (const route of ROUTES) {
    flat.push(route);
    if (route.children) {
      flat.push(...route.children);
    }
  }
  return flat;
}

export function normalizeRoutePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }
  return path.replace(/\/+$/, "") || "/";
}

export function isRouteEnabled(
  route: AppRoute,
  context: RouteVisibilityContext,
): boolean {
  if (route.hiddenWhen === "docker-unavailable") {
    return context.dockerInstalled === true;
  }
  return true;
}

export function getRoutes(): AppRoute[] {
  return [...ROUTES];
}

/** 사이드바에 표시할 메뉴 항목 (자식은 children에 유지) */
export function getSidebarRoutes(): AppRoute[] {
  return ROUTES.filter((route) => route.showInSidebar !== false);
}

export function getRouteById(id: RouteId): AppRoute | undefined {
  return getFlatRoutes().find((route) => route.id === id);
}

export function getRouteByPath(path: string): AppRoute | undefined {
  const normalized = normalizeRoutePath(path);
  const flat = getFlatRoutes();

  const exact = flat.find(
    (route) => normalizeRoutePath(route.path) === normalized,
  );
  if (exact) {
    return exact;
  }

  // `/docker` → 기본 자식(컨테이너)
  const parent = flat.find(
    (route) =>
      route.defaultChildId &&
      normalizeRoutePath(route.path) === normalized,
  );
  if (parent?.defaultChildId) {
    return getRouteById(parent.defaultChildId);
  }

  return undefined;
}

export function resolveNavigableRouteId(id: RouteId): RouteId {
  const route = getRouteById(id);
  if (route?.defaultChildId && !route.component) {
    return route.defaultChildId;
  }
  return id;
}

export function getRoutePath(id: RouteId): string {
  const navigableId = resolveNavigableRouteId(id);
  return (
    getRouteById(navigableId)?.path ?? getRouteById(DEFAULT_ROUTE_ID)!.path
  );
}

export function getRoutePage(id: RouteId): RoutePage {
  const navigableId = resolveNavigableRouteId(id);
  const route = getRouteById(navigableId);
  if (route?.component) {
    return route.component;
  }
  if (route?.defaultChildId) {
    const child = getRouteById(route.defaultChildId);
    if (child?.component) {
      return child.component;
    }
  }
  return getRouteById(DEFAULT_ROUTE_ID)!.component!;
}

export function isDockerRouteId(id: RouteId): boolean {
  return (DOCKER_ROUTE_IDS as readonly string[]).includes(id);
}

/** hash 우선, 없으면 pathname (레거시 replaceState 복구용) */
export function getBrowserRoutePath(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  const { hash, pathname } = window.location;
  if (hash.length > 1) {
    const raw = hash.slice(1);
    return normalizeRoutePath(raw.startsWith("/") ? raw : `/${raw}`);
  }

  return normalizeRoutePath(pathname);
}

/**
 * pathname이 `/`가 아니면 Vite/Tauri에서 스크립트·리소스 경로가 깨져 빈 화면이 날 수 있다.
 * hash 라우트만 쓰도록 URL을 `/` + hash 형태로 되돌린다.
 */
export function repairDocumentUrl(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (normalizeRoutePath(window.location.pathname) === "/") {
    return;
  }

  const hash = window.location.hash || "#/";
  window.history.replaceState(null, "", `/${hash}`);
}

export function syncBrowserPath(id: RouteId): void {
  if (typeof window === "undefined") {
    return;
  }

  repairDocumentUrl();

  const nextPath = getRoutePath(id);
  const nextHash = nextPath === "/" ? "#/" : `#${nextPath}`;
  if (window.location.hash === nextHash) {
    return;
  }

  window.location.hash = nextHash;
}
