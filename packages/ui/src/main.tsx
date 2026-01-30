import { createRoot } from "react-dom/client"
import "./index.css"
import { App } from "./App"
import { TooltipProvider } from "@/components/ui/tooltip"

// Note: StrictMode was removed to prevent duplicate events in the event log.
// React StrictMode double-invokes effects in development, which can cause
// side effects in the WebSocket connection singleton (ralphConnection.ts)
// to fire twice, resulting in duplicate event processing.
createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <App />
  </TooltipProvider>,
)
