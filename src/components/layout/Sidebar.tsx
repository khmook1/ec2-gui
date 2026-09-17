import { useEffect, useState } from "react";
import { IconButton } from "@/components/common/IconButton";
import { LogoIcon } from "@/components/common/LogoIcon";
import {
  ChevronDownNavIcon,
  LogOutNavIcon,
  MenuNavIcon,
} from "@/components/icons/NavIcons";
import type { AppRoute, RouteId } from "@/config/Route";
import { resolveNavigableRouteId } from "@/config/routeUtils";
import { useSshLogin } from "@/hooks/useSshLogin";
import { useSidebarNav } from "@/hooks/useSidebarNav";
import { useSidebarStore } from "@/stores/sidebarStore";
import "./css/sidebar.css";

function isChildActive(item: AppRoute, activeId: RouteId): boolean {
  if (item.id === activeId) {
    return true;
  }
  return item.children?.some((child) => child.id === activeId) ?? false;
}

function collectExpandedByActive(
  items: AppRoute[],
  activeId: RouteId,
): Partial<Record<RouteId, boolean>> {
  const next: Partial<Record<RouteId, boolean>> = {};
  for (const item of items) {
    if (item.children?.length && isChildActive(item, activeId)) {
      next[item.id] = true;
    }
  }
  return next;
}

export function Sidebar() {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const toggle = useSidebarStore((state) => state.toggle);
  const { logout } = useSshLogin();
  const { items, activeId, setActiveId, isItemEnabled } = useSidebarNav();
  const [expandedIds, setExpandedIds] = useState<
    Partial<Record<RouteId, boolean>>
  >(() => collectExpandedByActive(items, activeId));

  useEffect(() => {
    setExpandedIds((prev) => {
      const shouldOpen = collectExpandedByActive(items, activeId);
      let changed = false;
      const next = { ...prev };
      for (const [id, open] of Object.entries(shouldOpen) as [
        RouteId,
        boolean,
      ][]) {
        if (open && !prev[id]) {
          next[id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeId, items]);

  function handleNavigate(id: RouteId) {
    setActiveId(resolveNavigableRouteId(id));
  }

  function toggleExpanded(id: RouteId) {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  return (
    <aside
      className={["sidebar", isOpen ? "" : "sidebar--collapsed"]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!isOpen}
      inert={!isOpen || undefined}
    >
      <div className="sidebar__panel">
        <div className="sidebar__top">
          <LogoIcon size={40} />
          <IconButton
            tone="neutral"
            tooltip="사이드바 닫기"
            aria-label="사이드바 닫기"
            aria-expanded={true}
            className="sidebar__menu-btn"
            onClick={toggle}
          >
            <MenuNavIcon />
          </IconButton>
        </div>
        <div className="sidebar__brand">
          {/* 브랜드 이름 표시 들어갈 자리 */}
        </div>
        <nav className="sidebar__nav" aria-label="주 메뉴">
          {items.map((item) => {
            const enabled = isItemEnabled(item);
            const Icon = item.icon;
            const children = item.children?.filter(
              (child) => child.showInSidebar !== false,
            );
            const groupActive = isChildActive(item, activeId);

            if (children && children.length > 0) {
              const expanded = expandedIds[item.id] === true;
              const childrenId = `sidebar-children-${item.id}`;

              return (
                <div
                  key={item.id}
                  className={[
                    "sidebar__nav-group",
                    groupActive ? "sidebar__nav-group--active" : "",
                    expanded ? "sidebar__nav-group--expanded" : "",
                    !enabled ? "sidebar__nav-group--disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="sidebar__nav-group-row">
                    <button
                      type="button"
                      className={[
                        "sidebar__nav-item",
                        "sidebar__nav-item--group",
                        groupActive ? "sidebar__nav-item--group-active" : "",
                        !enabled ? "sidebar__nav-item--disabled" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-disabled={!enabled || undefined}
                      disabled={!enabled}
                      title={
                        !enabled && item.hiddenWhen === "docker-unavailable"
                          ? "원격 서버에 Docker가 없습니다"
                          : undefined
                      }
                      onClick={() => {
                        toggleExpanded(item.id);
                        handleNavigate(item.id);
                      }}
                    >
                      <Icon className="sidebar__nav-icon" />
                      <span className="sidebar__nav-label">{item.label}</span>
                    </button>
                    <button
                      type="button"
                      className={[
                        "sidebar__nav-toggle",
                        expanded ? "sidebar__nav-toggle--expanded" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-expanded={expanded}
                      aria-controls={childrenId}
                      aria-label={
                        expanded
                          ? `${item.label} 하위 메뉴 접기`
                          : `${item.label} 하위 메뉴 펼치기`
                      }
                      disabled={!enabled}
                      onClick={() => toggleExpanded(item.id)}
                    >
                      <ChevronDownNavIcon className="sidebar__nav-toggle-icon" />
                    </button>
                  </div>
                  <div
                    id={childrenId}
                    className={[
                      "sidebar__nav-children",
                      expanded ? "" : "sidebar__nav-children--collapsed",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    role="group"
                    aria-hidden={!expanded || undefined}
                    inert={!expanded || undefined}
                  >
                    {children.map((child) => {
                      const childEnabled = isItemEnabled(child);
                      const ChildIcon = child.icon;
                      const childActive = activeId === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          className={[
                            "sidebar__nav-item",
                            "sidebar__nav-item--child",
                            childActive ? "sidebar__nav-item--active" : "",
                            !childEnabled
                              ? "sidebar__nav-item--disabled"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-current={childActive ? "page" : undefined}
                          aria-disabled={!childEnabled || undefined}
                          disabled={!childEnabled}
                          tabIndex={expanded ? undefined : -1}
                          title={
                            !childEnabled &&
                            child.hiddenWhen === "docker-unavailable"
                              ? "원격 서버에 Docker가 없습니다"
                              : undefined
                          }
                          onClick={() => handleNavigate(child.id)}
                        >
                          <ChildIcon className="sidebar__nav-icon" />
                          <span className="sidebar__nav-label">
                            {child.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={[
                  "sidebar__nav-item",
                  isActive ? "sidebar__nav-item--active" : "",
                  !enabled ? "sidebar__nav-item--disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={!enabled || undefined}
                disabled={!enabled}
                title={
                  !enabled && item.hiddenWhen === "docker-unavailable"
                    ? "원격 서버에 Docker가 없습니다"
                    : undefined
                }
                onClick={() => handleNavigate(item.id)}
              >
                <Icon className="sidebar__nav-icon" />
                <span className="sidebar__nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <IconButton
            tone="neutral"
            tooltip="연결 해제"
            aria-label="연결 해제"
            onClick={() => void logout()}
          >
            <LogOutNavIcon />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}
