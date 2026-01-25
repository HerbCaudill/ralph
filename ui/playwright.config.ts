import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

// Test workspace path - isolated from the main repo's beads database
const TEST_WORKSPACE_PATH = path.join(import.meta.dirname, "e2e", "test-workspace")
const baseURL = process.env.PW_BASE_URL ?? "http://localhost:5180"
const shouldUseWebServer = !process.env.PW_BASE_URL

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 3,
  // Limit workers to reduce flakiness from resource contention
  workers: process.env.CI ? 1 : undefined,
  // Use dot reporter for minimal output in CI or when running under Ralph
  reporter: process.env.CI || process.env.RALPH_QUIET ? "dot" : "html",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // Increase default timeout for actions to be more resilient under load
  timeout: 30000,
  expect: {
    // Increase assertion timeout to handle CSS transitions and async operations
    timeout: 10000,
  },
  use: {
    // Use port 5180 for tests to avoid conflict with Ralph UI on 5179
    baseURL,
    trace: "on-first-retry",
    // Increase action timeout for more resilience
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer:
    shouldUseWebServer ?
      [
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
          // Use port 5180 to avoid conflict with Ralph UI's Vite server on 5179
          command: "pnpm dev -- --port 5180",
          url: "http://localhost:5180",
          // Must start fresh to ensure Vite proxies to the test server (4243), not the Ralph UI server (4242)
          reuseExistingServer: false,
          timeout: 30000,
          env: {
            PORT: "4243",
          },
        },
      ]
    : undefined,
})
