import { IconButton } from "@/components/common/IconButton";
import { LogoIcon } from "@/components/common/LogoIcon";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MenuNavIcon } from "@/components/icons/NavIcons";
import { TerminalIcon } from "@/components/icons/ToolbarIcons";
import { getRouteById } from "@/config/routeUtils";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNavStore } from "@/stores/navStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useTerminalStore } from "@/stores/terminalStore";
import type { AppRuntimeStatus } from "@/types/app";
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
  const headerTitle = getRouteById(activeId)?.headerTitle ?? "파일";

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
      </div>
      <div className="header__meta">
        {connection ? (
          <span className="chips__item chips__item--connection">
            {connection.username}@{connection.host}
          </span>
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
