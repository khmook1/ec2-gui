import { AppLayout } from "@/components/layout/AppLayout";
import { RouteOutlet } from "@/components/layout/RouteOutlet";
import { ServerSyncOverlay } from "@/components/common/ServerSyncOverlay";
import { useGlobalBackNavigation } from "@/hooks/useGlobalBackNavigation";
import { useRouteUrlSync } from "@/hooks/useRouteUrlSync";
import { useSettingsBootstrap } from "@/hooks/useSettingsBootstrap";
import { LoginPage } from "@/pages/Login";
import { useConnectionStore } from "@/stores/connectionStore";

function ConnectedMainView() {
  useRouteUrlSync();
  return <RouteOutlet />;
}

function App() {
  useGlobalBackNavigation();
  useSettingsBootstrap();

  const isConnected = useConnectionStore(
    (state) => state.status === "connected",
  );
  const showServerSyncOverlay = useConnectionStore(
    (state) => state.showServerSyncOverlay,
  );

  if (!isConnected) {
    return <LoginPage />;
  }

  return (
    <>
      <AppLayout>
        <ConnectedMainView />
      </AppLayout>
      {showServerSyncOverlay ? <ServerSyncOverlay /> : null}
    </>
  );
}

export default App;
