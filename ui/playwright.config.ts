import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

// Test workspace path - isolated from the main repo's beads database
const TEST_WORKSPACE_PATH = path.join(import.meta.dirname, "e2e", "test-workspace")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:5179",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm dev:server",
      url: "http://localhost:4243/api/workspace",
      // Always start fresh server to ensure WORKSPACE_PATH is set correctly
      // This prevents E2E tests from polluting the main repo's beads database
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        PORT: "4243",
        WORKSPACE_PATH: TEST_WORKSPACE_PATH,
      },
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5179",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        PORT: "4243",
      },
    },
  ],
})
