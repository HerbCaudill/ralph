import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "node:path"

const beadsPort = process.env.BEADS_PORT ?? "4243"
const agentPort = process.env.AGENT_SERVER_PORT ?? "4244"
const uiPort = parseInt(process.env.RALPH_UI_PORT ?? "5179", 10)

export default defineConfig({
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
      "/beads-ws": {
        target: `ws://localhost:${beadsPort}`,
        ws: true,
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
  },
})
