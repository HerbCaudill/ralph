import { defineConfig } from "vitest/config"

/** Use dot reporter in CI or when running under Ralph */
const useQuietReporter = !!(process.env.CI || process.env.RALPH_QUIET)

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "test/e2e/**", "ui/**"],
    reporters: useQuietReporter ? ["dot"] : ["default"],
  },
})
