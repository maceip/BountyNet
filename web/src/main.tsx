import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initThemeFromStorage } from "@/components/theme-toggle";
import "./index.css";
import App from "./App.tsx";

initThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TooltipProvider>
  </StrictMode>,
);
