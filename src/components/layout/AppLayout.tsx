import type { ReactNode } from "react";
import { ContentLayout } from "@/components/layout/ContentLayout";
import { Header } from "@/components/layout/Header";
import { SessionTabBar } from "@/components/layout/SessionTabBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TerminalPanel } from "@/components/terminal/Panel";
import { useAppInfo } from "@/hooks/useAppInfo";
import { useNewSshSessionShortcut } from "@/hooks/useNewSshSessionShortcut";
import { useCloseSshSessionShortcut } from "@/hooks/useCloseSshSessionShortcut";
import { useTerminalShortcut } from "@/hooks/useTerminalShortcut";
import { useSidebarStore } from "@/stores/sidebarStore";
import "./css/app-layout.css";

interface AppLayoutProps {
  children: ReactNode;
  showSessionTabs?: boolean;
}

export function AppLayout({
  children,
  showSessionTabs = false,
}: AppLayoutProps) {
  const { status } = useAppInfo();
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  useTerminalShortcut();
  useNewSshSessionShortcut();
  useCloseSshSessionShortcut();

  return (
    <div
      className={[
        "app-layout",
        isSidebarOpen ? "" : "app-layout--sidebar-collapsed",
        showSessionTabs ? "app-layout--session-tabs" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Sidebar />
      {showSessionTabs ? <SessionTabBar /> : null}
      <Header status={status} />
      <main className="main-content main-content--explorer">
        <div className="main-content__body">
          <ContentLayout>{children}</ContentLayout>
        </div>
        <TerminalPanel />
      </main>
    </div>
  );
}
