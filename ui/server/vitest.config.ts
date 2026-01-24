import { defineConfig } from "vitest/config"

/** Use minimal output when Ralph is running to save tokens */
const isRalphRunning = !!process.env.RALPH_RUNNING

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Increase timeouts for tests that spawn git processes (e.g., WorktreeManager tests)
    // These can be slow under parallel test load
    hookTimeout: 60000,
    testTimeout: 60000,
    ...(isRalphRunning && {
      reporter: ["dot"],
      silent: "passed-only",
    }),
  },
})
