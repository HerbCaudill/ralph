import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "node:path"

const beadsPort = process.env.BEADS_PORT ?? "4243"
const agentPort = process.env.AGENT_SERVER_PORT ?? "4244"
const uiPort = parseInt(process.env.RALPH_UI_PORT ?? "5179", 10)

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
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: uiPort,
    proxy: {
      // Beads server routes (task management)
      "/api/tasks": {
        target: `http://localhost:${beadsPort}`,
        changeOrigin: true,
      },
      "/api/labels": {
        target: `http://localhost:${beadsPort}`,
        changeOrigin: true,
      },
      "/api/workspace": {
        target: `http://localhost:${beadsPort}`,
        changeOrigin: true,
      },
      "/api/themes": {
        target: `http://localhost:${beadsPort}`,
        changeOrigin: true,
      },
      // Agent server routes (chat sessions)
      "/api": {
        target: `http://localhost:${agentPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://localhost:${agentPort}`,
        ws: true,
      },
    },

    ...localhostServer,
  },
})
