import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "node:path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 4242,
    proxy: {
      "/api": {
        target: "http://localhost:4244",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:4244",
        ws: true,
      },
    },
  },
})
