#!/usr/bin/env node
/**
 * Development script for the beads task manager demo: starts beads-server + demo frontend.
 *
 * Builds all workspace dependencies in topological order before starting,
 * then keeps them in watch mode so changes trigger automatic rebuilds.
 */
import { runDev } from "./lib/devRunner.js"

runDev({
  label: "beads-demo",
  waitForHealthz: true,
  preBuild: [
    "pnpm --filter components --filter agent-view-theme build",
    "pnpm --filter agent-view build",
    "pnpm --filter ralph-shared build",
    "pnpm --filter beads-view build",
  ],
  services: [
    // Watchers for dependency packages
    { name: "components", command: "pnpm --filter components dev" },
    { name: "agent-view-theme", command: "pnpm --filter agent-view-theme dev" },
    { name: "agent-view", command: "pnpm --filter agent-view dev" },
    { name: "shared", command: "pnpm --filter ralph-shared dev" },
    { name: "beads-view", command: "pnpm --filter beads-view dev" },

    // Backend server
    {
      name: "beads-server",
      command: "pnpm --filter beads-server dev",
      portEnv: "BEADS_PORT",
      defaultPort: 4243,
    },
  ],
  frontend: {
    package: "@herbcaudill/beads-demo",
    portEnv: "DEMO_BEADS_PORT",
    defaultPort: 5181,
    open: true,
  },
  env: { WORKSPACE_PATH: process.env.WORKSPACE_PATH ?? process.cwd() },
}).catch(err => {
  console.error("[beads-demo] Error:", err.message)
  process.exit(1)
})
