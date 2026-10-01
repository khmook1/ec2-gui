import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getAppName } from "@/lib/env";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSshSessionStore } from "@/stores/sshSessionStore";

/** 연결된 서버가 있으면 메모(없으면 IP), 아니면 앱 이름을 창 제목으로 쓴다. */
export function useWindowTitle() {
  const isConnected = useConnectionStore(
    (state) => state.status === "connected",
  );
  const serverLabel = useSshSessionStore((state) => {
    const active = state.sessions.find(
      (session) => session.id === state.activeSessionId,
    );
    if (!active) return null;
    return active.memo ?? active.connection.host;
  });

  const title = isConnected && serverLabel ? serverLabel : getAppName();

  useEffect(() => {
    document.title = title;
    void getCurrentWindow()
      .setTitle(title)
      .catch(() => {
        // 브라우저에서 vite만 실행할 때는 Tauri window API가 없을 수 있음
      });
  }, [title]);
}
