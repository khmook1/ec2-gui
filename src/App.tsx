import { AppLayout } from "@/components/layout/AppLayout";
import { RouteOutlet } from "@/components/layout/RouteOutlet";
import { ServerSyncOverlay } from "@/components/common/ServerSyncOverlay";
import { useGlobalBackNavigation } from "@/hooks/useGlobalBackNavigation";
import { useRouteUrlSync } from "@/hooks/useRouteUrlSync";
import { useSettingsBootstrap } from "@/hooks/useSettingsBootstrap";
import { useWindowTitle } from "@/hooks/useWindowTitle";
import { LoginPage } from "@/pages/Login";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSshSessionStore } from "@/stores/sshSessionStore";

function ConnectedMainView() {
  useRouteUrlSync();
  return <RouteOutlet />;
}

function App() {
  useGlobalBackNavigation();
  useSettingsBootstrap();
  useWindowTitle();

  const isConnected = useConnectionStore(
    (state) => state.status === "connected",
  );
  const showServerSyncOverlay = useConnectionStore(
    (state) => state.showServerSyncOverlay,
  );
  const isAddingSession = useSshSessionStore((state) => state.isAddingSession);
  const sessionCount = useSshSessionStore((state) => state.sessions.length);

  const showLogin = !isConnected || isAddingSession;

  if (showLogin) {
    return <LoginPage />;
  }

  return (
    <>
      <AppLayout showSessionTabs={sessionCount > 1}>
        <ConnectedMainView />
      </AppLayout>
      {showServerSyncOverlay ? <ServerSyncOverlay /> : null}
    </>
  );
}

export default App;
