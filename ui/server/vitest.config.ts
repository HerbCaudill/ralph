import { defineConfig } from "vitest/config"

/** Use dot reporter in CI or when running under Ralph */
const useQuietReporter = !!(process.env.CI || process.env.RALPH_QUIET)

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Increase timeouts for tests that spawn git processes (e.g., WorktreeManager tests)
    // These can be slow under parallel test load
    hookTimeout: 60000,
    testTimeout: 60000,
    reporters: useQuietReporter ? ["dot"] : ["default"],
  },
})
