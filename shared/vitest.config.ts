import { defineConfig } from "vitest/config"

/** Use minimal output when Ralph is running to save tokens */
const isRalphRunning = !!process.env.RALPH_RUNNING

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    ...(isRalphRunning && {
      reporter: ["dot"],
      silent: "passed-only",
    }),
  },
})
