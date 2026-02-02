import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const beadsServerPort = process.env.BEADS_PORT || process.env.PORT || "4243"
const vitePort = Number(process.env.DEMO_BEADS_PORT || "5181")

export default defineConfig({
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
