import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { repairDocumentUrl } from "@/config/routeUtils";
import { hydrateLoginHistory } from "@/lib/loginCache";
import { AiChatbotProvider } from "@/providers/AiChatbotProvider";
import { AutoRefreshProvider } from "@/providers/AutoRefreshProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

repairDocumentUrl();

void hydrateLoginHistory().finally(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <AutoRefreshProvider>
          <ToastProvider>
            <AiChatbotProvider>
              <App />
            </AiChatbotProvider>
          </ToastProvider>
        </AutoRefreshProvider>
      </QueryProvider>
    </StrictMode>,
  );
});
