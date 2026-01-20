import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
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
      command: "PORT=4242 pnpm dev:server",
      url: "http://localhost:4242/api/workspace",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5179",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
})
