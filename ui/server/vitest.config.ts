import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Increase timeouts for tests that spawn git processes (e.g., WorktreeManager tests)
    // These can be slow under parallel test load
    hookTimeout: 60000,
    testTimeout: 60000,
  },
})
