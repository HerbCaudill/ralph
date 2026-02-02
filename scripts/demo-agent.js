#!/usr/bin/env node
/** Development script for the agent chat demo: starts agent-server + demo frontend. */
import { runDev } from "./lib/devRunner.js"

runDev({
  label: "demo-agent",
  services: [
    {
      name: "agent-server",
      command: "pnpm --filter @herbcaudill/agent-server dev",
      portEnv: "AGENT_SERVER_PORT",
      defaultPort: 4244,
    },
  ],
  frontend: {
    package: "@herbcaudill/demo-agent",
    portEnv: "DEMO_AGENT_PORT",
    defaultPort: 5180,
    open: true,
  },
  env: { WORKSPACE_PATH: process.env.WORKSPACE_PATH ?? process.cwd() },
}).catch(err => {
  console.error("[demo-agent] Error:", err.message)
  process.exit(1)
})
