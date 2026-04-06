import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initThemeFromStorage } from "@/components/theme-toggle";
import { GatewayProvider } from "@/context/gateway-context";
import "./index.css";
import App from "./App.tsx";

initThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <GatewayProvider>
        <TooltipProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </TooltipProvider>
      </GatewayProvider>
    </BrowserRouter>
  </StrictMode>,
);
