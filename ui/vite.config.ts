import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

// Server port - matches the default in server/index.ts
const serverPort = process.env.PORT || "4242"

export default defineConfig({
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
          proxy.on("error", (err: NodeJS.ErrnoException, _req, _res) => {
            if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
              console.error("[ws proxy]", err.message)
            }
          })
          proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
            socket.on("error", (_err: NodeJS.ErrnoException) => {
              // Silently ignore - these errors are expected during rapid reconnects
            })
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
