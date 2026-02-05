#!/usr/bin/env node
/**
 * Development script that starts beads-server, agent-server, and UI.
 *
 * The UI is frontend-only and connects to these backend servers.
 */
import { runDev } from "./lib/devRunner.js"

const workspacePath = process.env.WORKSPACE_PATH ?? process.cwd()

runDev({
  label: "dev",
  waitForHealthz: true,
  services: [
    {
      name: "beads-server",
      command: "pnpm --filter @herbcaudill/beads-server dev",
      portEnv: "BEADS_PORT",
      defaultPort: 4243,
    },
    {
      name: "agent-server",
      command: "pnpm --filter @herbcaudill/agent-server dev",
      portEnv: "AGENT_SERVER_PORT",
      defaultPort: 4244,
    },
  ],
  frontend: {
    package: "@herbcaudill/ralph-ui",
    portEnv: "RALPH_UI_PORT",
    defaultPort: 5179,
    open: true,
  },
  env: { WORKSPACE_PATH: workspacePath },
}).catch(err => {
  console.error("[dev] Error:", err.message)
  process.exit(1)
})
