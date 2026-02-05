#!/usr/bin/env node
/** Development script for the agent chat demo: starts agent-server + demo frontend. */
import { runDev } from "./lib/devRunner.js"

runDev({
  label: "agent-demo",
  waitForHealthz: true,
  services: [
    {
      name: "agent-server",
      command: "pnpm --filter @herbcaudill/agent-server dev",
      portEnv: "AGENT_SERVER_PORT",
      defaultPort: 4244,
    },
  ],
  frontend: {
    package: "@herbcaudill/agent-demo",
    portEnv: "DEMO_AGENT_PORT",
    defaultPort: 5180,
    open: true,
  },
  env: { WORKSPACE_PATH: process.env.WORKSPACE_PATH ?? process.cwd() },
}).catch(err => {
  console.error("[agent-demo] Error:", err.message)
  process.exit(1)
})
