import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const agentServerPort = process.env.AGENT_SERVER_PORT || process.env.PORT || "4242"

export default defineConfig({
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: `http://localhost:${agentServerPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `http://localhost:${agentServerPort}`,
        ws: true,
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
