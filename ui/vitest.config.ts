import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

/** Use minimal output when Ralph is running to save tokens */
const isRalphRunning = !!process.env.RALPH_RUNNING

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/vitest-setup.ts"],
    exclude: ["node_modules", "e2e"],
    // Use node environment for server tests
    environmentMatchGlobs: [["server/**/*.test.ts", "node"]],
    // Increase timeouts for server tests that spawn git processes (e.g., WorktreeManager tests)
    // These can be slow under parallel test load
    hookTimeout: 60000,
    testTimeout: 60000,
    ...(isRalphRunning && {
      reporter: ["dot"],
      silent: "passed-only",
    }),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
