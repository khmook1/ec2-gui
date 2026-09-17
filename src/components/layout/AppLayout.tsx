import type { ReactNode } from "react";
import { ContentLayout } from "@/components/layout/ContentLayout";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { TerminalPanel } from "@/components/terminal/Panel";
import { useAppInfo } from "@/hooks/useAppInfo";
import { useDockerCacheSession } from "@/hooks/useDockerCacheSession";
import { useTerminalShortcut } from "@/hooks/useTerminalShortcut";
import { useSidebarStore } from "@/stores/sidebarStore";
import "./css/app-layout.css";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { status } = useAppInfo();
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  useDockerCacheSession();
  useTerminalShortcut();

  return (
    <div
      className={[
        "app-layout",
        isSidebarOpen ? "" : "app-layout--sidebar-collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Sidebar />
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
