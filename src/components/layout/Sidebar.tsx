import { IconButton } from "@/components/common/IconButton";
import { LogoIcon } from "@/components/common/LogoIcon";
import { LogOutNavIcon, MenuNavIcon } from "@/components/icons/NavIcons";
import { useEc2Login } from "@/hooks/useEc2Login";
import { useSidebarNav } from "@/hooks/useSidebarNav";
import { useSidebarStore } from "@/stores/sidebarStore";

export function Sidebar() {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const toggle = useSidebarStore((state) => state.toggle);
  const { logout } = useEc2Login();
  const { items, activeId, setActiveId, isItemEnabled } = useSidebarNav();

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
          {/* <div className="sidebar__brand-name">{getAppName()}</div>
          <div className="sidebar__brand-sub">
          </div> */}
        </div>
        <nav className="sidebar__nav" aria-label="주 메뉴">
          {items.map((item) => {
            const isActive = activeId === item.id;
            const enabled = isItemEnabled(item);
            const Icon = item.icon;
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
                onClick={() => setActiveId(item.id)}
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
