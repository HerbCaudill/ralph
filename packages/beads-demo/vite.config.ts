import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const beadsServerPort =
  process.env.BEADS_PORT || (!process.env.PORTLESS_URL && process.env.PORT) || "4243"
const vitePort = Number(process.env.DEMO_BEADS_PORT || "5181")

/** Route the assigned loopback port and hot reload through the shared HTTPS proxy. */
const localhostServer = process.env.PORTLESS_URL
  ? {
      port: Number(process.env.PORT),
      host: "127.0.0.1",
      strictPort: true,
      allowedHosts: [new URL(process.env.PORTLESS_URL).hostname],
      hmr: {
        protocol: "wss" as const,
        host: new URL(process.env.PORTLESS_URL).hostname,
        clientPort: 443,
      },
    }
  : {}

export default defineConfig({
  ...(process.env.PORTLESS_URL
    ? { cacheDir: `node_modules/.cache/localhost-dev/${process.env.PORT}` }
    : {}),
  server: {
    port: vitePort,
    proxy: {
      "/api": {
        target: `http://localhost:${beadsServerPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `http://localhost:${beadsServerPort}`,
        ws: true,
        configure: proxy => {
          proxy.on("error", () => {})
        },
      },
    },

    ...localhostServer,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
