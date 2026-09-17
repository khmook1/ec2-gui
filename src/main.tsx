import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { repairDocumentUrl } from "@/config/routeUtils";
import { getAppName } from "@/lib/env";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

repairDocumentUrl();

const appName = getAppName();
document.title = appName;
void getCurrentWindow()
  .setTitle(appName)
  .catch(() => {
    // 브라우저에서 vite만 실행할 때는 Tauri window API가 없을 수 있음
  });

createRoot(rootElement).render(
  <StrictMode>
    <QueryProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryProvider>
  </StrictMode>,
);
