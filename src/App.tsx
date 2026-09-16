import { AppLayout } from "@/components/layout/AppLayout";
import { NAV_VIEW } from "@/config/sidebarNav";
import { useGlobalBackNavigation } from "@/hooks/useGlobalBackNavigation";
import { useSettingsBootstrap } from "@/hooks/useSettingsBootstrap";
import { DashboardPage } from "@/pages/Dashboard";
import { DockerPage } from "@/pages/Docker";
import { FileExplorerPage } from "@/pages/FileExplorer";
import { LoginPage } from "@/pages/Login";
import { SettingsPage } from "@/pages/Settings";
import { useConnectionStore } from "@/stores/connectionStore";
import { useNavStore } from "@/stores/navStore";

function ConnectedMainView() {
  const activeId = useNavStore((state) => state.activeId);

  if (activeId === NAV_VIEW.docker) {
    return <DockerPage />;
  }

  if (activeId === NAV_VIEW.fileExplorer) {
    return <FileExplorerPage />;
  }

  if (activeId === NAV_VIEW.settings) {
    return <SettingsPage />;
  }

  return <DashboardPage />;
}

function App() {
  useGlobalBackNavigation();
  useSettingsBootstrap();

  const isConnected = useConnectionStore(
    (state) => state.status === "connected",
  );

  if (!isConnected) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <ConnectedMainView />
    </AppLayout>
  );
}

export default App;
