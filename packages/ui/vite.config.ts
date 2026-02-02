import { defineConfig, createLogger } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

// Server ports for the dual-server architecture:
// - beads-server: Task/label management, workspace info, mutation events
// - agent-server: Agent control, instance management, task chat, agent events
// When split server ports are not set, all traffic goes to the combined server (backward compat).
const serverPort = process.env.PORT || "4242"
const beadsServerPort = process.env.BEADS_PORT || serverPort
const agentServerPort = process.env.AGENT_SERVER_PORT || serverPort

// Custom logger that filters out proxy errors during tests
// These errors occur when tests make API calls without a backend server
const logger = createLogger()
const originalError = logger.error.bind(logger)
const originalWarn = logger.warn.bind(logger)
logger.error = (msg, options) => {
  if (typeof msg === "string") {
    // Ignore WebSocket proxy errors from rapid reconnects or missing backend
    // These occur during tests when no backend server is running
    if (msg.includes("ws proxy error") || msg.includes("ws proxy")) {
      return
    }
    // Ignore HTTP proxy errors when backend isn't running (e.g., during Storybook tests)
    if (msg.includes("http proxy error")) {
      return
    }
  }
  originalError(msg, options)
}
logger.warn = (msg, options) => {
  if (typeof msg === "string") {
    // Ignore HTTP proxy errors when backend isn't running
    if (msg.includes("http proxy error")) {
      return
    }
  }
  originalWarn(msg, options)
}

/** Create a WebSocket proxy error handler to suppress expected connection errors. */
function configureWsProxy(label: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (proxy: any) => {
    proxy.on("error", (err: NodeJS.ErrnoException, _req: unknown, res: unknown) => {
      const isExpectedError =
        err.code === "EPIPE" ||
        err.code === "ECONNRESET" ||
        err.code === "ECONNREFUSED" ||
        err.constructor?.name === "AggregateError" ||
        (err as Error).name === "AggregateError"
      if (isExpectedError) {
        const httpRes = res as {
          writeHead?: (code: number) => void
          end?: () => void
          headersSent?: boolean
        }
        if (httpRes && typeof httpRes.writeHead === "function" && !httpRes.headersSent) {
          httpRes.writeHead(502)
          httpRes.end?.()
        }
        return
      }
      console.error(label, err.message)
    })
    proxy.on(
      "proxyReqWs",
      (
        _proxyReq: unknown,
        _req: unknown,
        socket: { on: (event: string, handler: () => void) => void },
      ) => {
        socket.on("error", () => {})
      },
    )
    proxy.on("open", (proxySocket: { on: (event: string, handler: () => void) => void }) => {
      proxySocket.on("error", () => {})
    })
    proxy.on("close", (_req: unknown, socket: { destroy?: () => void } | null) => {
      if (socket && typeof socket.destroy === "function") {
        socket.destroy()
      }
    })
  }
}

export default defineConfig({
  customLogger: logger,
  server: {
    port: 5179,
    proxy: {
      // --- Beads-server API routes (tasks, labels, workspaces) ---
      "/api/tasks": {
        target: `http://localhost:${beadsServerPort}`,
        changeOrigin: true,
      },
      "/api/labels": {
        target: `http://localhost:${beadsServerPort}`,
        changeOrigin: true,
      },
      "/api/workspace": {
        target: `http://localhost:${beadsServerPort}`,
        changeOrigin: true,
      },
      "/api/workspaces": {
        target: `http://localhost:${beadsServerPort}`,
        changeOrigin: true,
      },

      // --- Agent-server API routes (ralph control, instances, task-chat) ---
      // Specific agent paths are listed first; the catch-all "/api" below
      // handles any remaining routes via the legacy combined server.
      "/api/ralph": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/task-chat": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/instances": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/start": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/stop": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/pause": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/resume": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/status": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/message": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/stop-after-current": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/cancel-stop-after-current": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/api/state": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },

      // --- Fallback: any unmatched /api/* routes go to the legacy combined server ---
      "/api": {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },

      // --- Beads-server WebSocket (mutation events) ---
      // Client connects to /beads-ws, proxy rewrites to /ws on beads-server
      "/beads-ws": {
        target: `http://localhost:${beadsServerPort}`,
        ws: true,
        rewrite: path => path.replace(/^\/beads-ws/, "/ws"),
        configure: configureWsProxy("[beads-ws proxy]"),
      },

      // --- Agent-server WebSocket (agent events, task chat) ---
      "/ws": {
        target: `http://localhost:${agentServerPort}`,
        ws: true,
        configure: configureWsProxy("[ws proxy]"),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Ralph",
        short_name: "ralph-ui",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Exclude API routes from navigation fallback
        navigateFallbackDenylist: [/^\/api\//],
        // Ensure API routes are not handled by the service worker at all
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
