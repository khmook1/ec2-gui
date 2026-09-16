import { useEffect } from "react";
import { getAppInfo } from "@/services/tauri";
import { useAppStore } from "@/stores/appStore";

export function useAppInfo() {
  const status = useAppStore((state) => state.status);
  const appInfo = useAppStore((state) => state.appInfo);
  const errorMessage = useAppStore((state) => state.errorMessage);
  const setStatus = useAppStore((state) => state.setStatus);
  const setAppInfo = useAppStore((state) => state.setAppInfo);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => {
    let cancelled = false;

    async function loadAppInfo() {
      setStatus("loading");

      try {
        const info = await getAppInfo();
        if (!cancelled) {
          setAppInfo(info);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "앱 정보를 불러오지 못했습니다.";
          setError(message);
        }
      }
    }

    void loadAppInfo();

    return () => {
      cancelled = true;
    };
  }, [setAppInfo, setError, setStatus]);

  return {
    status,
    appInfo,
    errorMessage,
    isReady: status === "ready",
  };
}
