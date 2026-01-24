import { defineConfig } from "vitest/config"

/** Use minimal output when Ralph is running to save tokens */
const isRalphRunning = !!process.env.RALPH_RUNNING

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "test/e2e/**", "ui/**"],
    slowTestThreshold: Infinity,
    ...(isRalphRunning && {
      reporter: ["dot"],
      silent: "passed-only",
    }),
  },
})
