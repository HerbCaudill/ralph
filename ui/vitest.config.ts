import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

/** Use minimal output when Ralph is running to save tokens */
const isRalphRunning = !!process.env.RALPH_RUNNING

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    exclude: ["node_modules", "e2e"],
    // Increase timeouts for server tests that spawn git processes (e.g., WorktreeManager tests)
    // These can be slow under parallel test load
    hookTimeout: 60000,
    testTimeout: 60000,
    slowTestThreshold: Infinity,
    ...(isRalphRunning && {
      reporter: ["dot"],
      silent: "passed-only",
    }),
    // Use node environment for server tests (projects replaces deprecated environmentMatchGlobs)
    projects: [
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/vitest-setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
