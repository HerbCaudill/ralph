import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const agentServerPort = process.env.AGENT_SERVER_PORT || process.env.PORT || "4244"
const vitePort = Number(process.env.DEMO_AGENT_PORT || "5180")

export default defineConfig({
  server: {
    port: vitePort,
    proxy: {
      "/api": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `http://localhost:${agentServerPort}`,
        ws: true,
        configure: proxy => {
          proxy.on("error", () => {})
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
