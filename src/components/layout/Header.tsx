import { IconButton } from "@/components/common/IconButton";
import { LogoIcon } from "@/components/common/LogoIcon";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MenuNavIcon } from "@/components/icons/NavIcons";
import { TerminalIcon } from "@/components/icons/ToolbarIcons";
import { PermissionBadge } from "@/components/layout/PermissionBadge";
import { getRouteById } from "@/config/routeUtils";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNavStore } from "@/stores/navStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type { AppRuntimeStatus } from "@/types/app";
import { isAutoRefreshInterval } from "@/types/autoRefresh";
import "./css/header.css";

interface HeaderProps {
  status: AppRuntimeStatus;
}

export function Header({ status }: HeaderProps) {
  const connection = useConnectionStore((state) => state.connection);
  const activeId = useNavStore((state) => state.activeId);
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const isTerminalOpen = useTerminalStore((state) => state.isOpen);
  const toggleTerminal = useTerminalStore((state) => state.toggle);
  const {
    interval,
    options,
    setInterval: setAutoRefreshInterval,
  } = useAutoRefresh();
  const headerTitle = getRouteById(activeId)?.headerTitle ?? "파일";

  function handleRefreshChange(value: string) {
    if (isAutoRefreshInterval(value)) {
      setAutoRefreshInterval(value);
    }
  }

  return (
    <header className="header">
      <div className="header__leading">
        <div
          className={[
            "header__menu",
            isSidebarOpen ? "header__menu--hidden" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <IconButton
            tone="neutral"
            tooltip="사이드바 열기"
            tooltipPosition="bottom"
            aria-label="사이드바 열기"
            aria-expanded={false}
            aria-hidden={isSidebarOpen}
            tabIndex={isSidebarOpen ? -1 : undefined}
            className="header__menu-btn"
            onClick={toggleSidebar}
          >
            <MenuNavIcon />
          </IconButton>
          <LogoIcon size={28} aria-hidden={isSidebarOpen} />
        </div>
        <div className="header__title">{headerTitle}</div>
        {connection ? (
          <label className="header__refresh">
            <span className="header__refresh-label">새로고침 주기</span>
            <select
              className="header__refresh-select"
              aria-label="자동 새로고침"
              value={interval}
              onChange={(event) => handleRefreshChange(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="header__meta">
        {connection ? (
          <>
            <span className="chips__item chips__item--connection">
              {connection.username}@{connection.host}
            </span>
            <PermissionBadge />
          </>
        ) : null}
        <IconButton
          tone="neutral"
          tooltip="터미널 (⌘`)"
          aria-label="터미널 토글"
          aria-pressed={isTerminalOpen}
          onClick={toggleTerminal}
        >
          <TerminalIcon />
        </IconButton>
        <StatusBadge status={status} />
      </div>
    </header>
  );
}
