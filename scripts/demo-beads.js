#!/usr/bin/env node
/** Development script for the beads task manager demo: starts beads-server + demo frontend. */
import { runDev } from "./lib/devRunner.js"

runDev({
  label: "demo-beads",
  services: [
    {
      name: "beads-server",
      command: "pnpm --filter @herbcaudill/beads-server dev",
      portEnv: "BEADS_PORT",
      defaultPort: 4243,
    },
  ],
  frontend: {
    package: "@herbcaudill/demo-beads",
    portEnv: "DEMO_BEADS_PORT",
    defaultPort: 5181,
    open: true,
  },
  env: { WORKSPACE_PATH: process.env.WORKSPACE_PATH ?? process.cwd() },
}).catch(err => {
  console.error("[demo-beads] Error:", err.message)
  process.exit(1)
})
