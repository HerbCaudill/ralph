import { defineConfig, createLogger } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

// Server port - matches the default in server/index.ts
const serverPort = process.env.PORT || "4242"

// Custom logger that filters out proxy errors during tests
// These errors occur when tests make API calls without a backend server
const logger = createLogger()
const originalError = logger.error.bind(logger)
const originalWarn = logger.warn.bind(logger)
logger.error = (msg, options) => {
  if (typeof msg === "string") {
    // Ignore WebSocket proxy errors (EPIPE, ECONNRESET) from rapid reconnects
    if (msg.includes("ws proxy") && (msg.includes("EPIPE") || msg.includes("ECONNRESET"))) {
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

export default defineConfig({
  customLogger: logger,
  server: {
    port: 5179,
    proxy: {
      "/api": {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `http://localhost:${serverPort}`,
        ws: true,
        configure: proxy => {
          // Suppress EPIPE and ECONNRESET errors that occur when WebSocket clients disconnect
          proxy.on("error", (err: NodeJS.ErrnoException, _req, res) => {
            if (err.code === "EPIPE" || err.code === "ECONNRESET") {
              // Silently ignore - these errors are expected during rapid reconnects
              // End the response if it exists and hasn't been sent
              if (res && "writeHead" in res && !res.headersSent) {
                res.writeHead(502)
                res.end()
              }
              return
            }
            console.error("[ws proxy]", err.message)
          })
          proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
            socket.on("error", (_err: NodeJS.ErrnoException) => {
              // Silently ignore - these errors are expected during rapid reconnects
            })
          })
          // Also handle errors on the target socket
          proxy.on("open", proxySocket => {
            proxySocket.on("error", (_err: NodeJS.ErrnoException) => {
              // Silently ignore
            })
          })
          // Handle close events to prevent error propagation
          proxy.on("close", (_req, socket) => {
            if (socket && typeof socket.destroy === "function") {
              socket.destroy()
            }
          })
        },
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
