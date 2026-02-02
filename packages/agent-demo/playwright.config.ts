import { defineConfig, devices } from "@playwright/test"

const agentServerPort = Number(process.env.AGENT_SERVER_PORT || "4244")
const vitePort = Number(process.env.DEMO_AGENT_PORT || "5180")
const claudeModel = process.env.CLAUDE_MODEL || "claude-haiku-4-20250414"

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
        CLAUDE_MODEL: claudeModel,
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
