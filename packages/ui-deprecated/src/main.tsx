import { createRoot } from "react-dom/client"
import "./index.css"
import { App } from "./App"
import { TooltipProvider } from "@/components/ui/tooltip"
import { configureApiClient } from "@herbcaudill/beads-view"
import { getServerUrls } from "./lib/serverConfig"

// Configure the beads-view API client with the beads-server URL.
// In dev mode with Vite proxy this is "" (relative), but when explicit URLs
// are set via VITE_BEADS_SERVER_URL it routes to the beads-server directly.
const { beadsHttp } = getServerUrls()
if (beadsHttp) {
  configureApiClient({ baseUrl: beadsHttp })
}

// Note: StrictMode was removed to prevent duplicate events in the event log.
// React StrictMode double-invokes effects in development, which can cause
// side effects in the WebSocket connection singleton (ralphConnection.ts)
// to fire twice, resulting in duplicate event processing.
createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <App />
  </TooltipProvider>,
)
