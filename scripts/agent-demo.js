#!/usr/bin/env node
/**
 * Development script for the agent chat demo: starts agent-server + demo frontend.
 *
 * Builds all workspace dependencies in topological order before starting,
 * then keeps them in watch mode so changes trigger automatic rebuilds.
 */
import { runDev } from "./lib/devRunner.js"

runDev({
  label: "agent-demo",
  waitForHealthz: true,
  preBuild: [
    "pnpm --filter components --filter agent-view-theme build",
    "pnpm --filter agent-view build",
    "pnpm --filter ralph-shared --filter agent-view-claude --filter agent-view-codex build",
    "pnpm --filter beads-view build",
  ],
  services: [
    // Watchers for dependency packages
    { name: "components", command: "pnpm --filter components dev" },
    { name: "agent-view-theme", command: "pnpm --filter agent-view-theme dev" },
    { name: "agent-view", command: "pnpm --filter agent-view dev" },
    { name: "agent-view-claude", command: "pnpm --filter agent-view-claude dev" },
    { name: "agent-view-codex", command: "pnpm --filter agent-view-codex dev" },
    { name: "shared", command: "pnpm --filter ralph-shared dev" },
    { name: "beads-view", command: "pnpm --filter beads-view dev" },

    // Backend server
    {
      name: "agent-server",
      command: "pnpm --filter agent-server dev",
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
