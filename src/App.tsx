import { AppLayout } from "@/components/layout/AppLayout";
import { RouteOutlet } from "@/components/layout/RouteOutlet";
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
