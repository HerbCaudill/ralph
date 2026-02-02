#!/usr/bin/env node
/**
 * Development script that runs beads-server + agent-server + UI as separate processes.
 *
 * This is the "split server" alternative to dev.js (which runs the combined server).
 * Each server gets its own port and the Vite dev proxy routes requests accordingly.
 */
import { runDev } from "./lib/devRunner.js"

const workspacePath = process.env.WORKSPACE_PATH ?? process.cwd()

runDev({
  label: "dev-split",
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
    {
      name: "ralph-server",
      command: "pnpm --filter @herbcaudill/ralph-server dev",
      portEnv: "RALPH_SERVER_PORT",
      defaultPort: 4245,
    },
  ],
  frontend: {
    package: "@herbcaudill/ralph-ui",
    portEnv: "RALPH_UI_PORT",
    defaultPort: 5179,
    open: true,
    env: { VITE_SPLIT_SERVERS: "true" },
  },
  env: { WORKSPACE_PATH: workspacePath },
}).catch(err => {
  console.error("[dev-split] Error:", err.message)
  process.exit(1)
})
