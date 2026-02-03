import { defineConfig, devices } from "@playwright/test"

// Use dedicated test ports to avoid conflicts with development servers.
// This allows tests to run reliably even when dev servers are active.
const agentServerTestPort = Number(process.env.AGENT_SERVER_TEST_PORT || "4254")
const viteTestPort = Number(process.env.DEMO_AGENT_TEST_PORT || "5190")
const claudeModel = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001"

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
    baseURL: `http://localhost:${viteTestPort}`,
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
      // Use a dedicated test port for the agent server to avoid conflicts with
      // development servers (e.g., beads-server may be running on 4244).
      command: "pnpm --filter @herbcaudill/agent-server dev",
      url: `http://localhost:${agentServerTestPort}/healthz`,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        AGENT_SERVER_PORT: String(agentServerTestPort),
        CLAUDE_MODEL: claudeModel,
      },
    },
    {
      // Use a dedicated test port for the Vite server to avoid conflicts with
      // development servers (e.g., ralph-ui may be running on 5180).
      command: `pnpm dev:headless --port ${viteTestPort}`,
      url: `http://localhost:${viteTestPort}`,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        AGENT_SERVER_PORT: String(agentServerTestPort),
      },
    },
  ],
})
