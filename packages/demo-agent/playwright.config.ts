import { defineConfig, devices } from "@playwright/test"

const agentServerPort = 4244
const vitePort = 5180

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "dot" : "html",
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: `http://localhost:${vitePort}`,
    trace: "on-first-retry",
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @herbcaudill/agent-server dev",
      url: `http://localhost:${agentServerPort}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        AGENT_SERVER_PORT: String(agentServerPort),
      },
    },
    {
      command: `pnpm dev:headless --port ${vitePort}`,
      url: `http://localhost:${vitePort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        AGENT_SERVER_PORT: String(agentServerPort),
      },
    },
  ],
})
