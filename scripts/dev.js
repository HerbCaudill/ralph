#!/usr/bin/env node
/**
 * Development script that starts beads-server, agent-server, and UI.
 *
 * Builds all workspace dependencies in topological order before starting,
 * then keeps them in watch mode so changes trigger automatic rebuilds.
 */
import { runDev } from "./lib/devRunner.js"
import { ensureDoltServer } from "./lib/ensureDoltServer.js"

const workspacePath = process.env.WORKSPACE_PATH ?? process.cwd()

runDev({
  preStart: [() => ensureDoltServer(workspacePath)],
  label: "dev",
  waitForHealthz: true,
  preBuild: [
    "pnpm --filter components --filter agent-view-theme build",
    "pnpm --filter agent-view build",
    "pnpm --filter ralph-shared --filter agent-view-claude --filter agent-view-codex build",
    "pnpm --filter beads-view build",
    "pnpm --filter agent-server --filter beads-server build",
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

    // Backend servers — tsc watchers keep dist/ in sync with source
    {
      name: "agent-server-build",
      command: "pnpm --filter agent-server exec tsc --watch --preserveWatchOutput",
    },
    {
      name: "beads-server-build",
      command: "pnpm --filter beads-server exec tsc --watch --preserveWatchOutput",
    },

    // Backend servers — tsx --watch restarts when dist/ changes
    {
      name: "beads-server",
      command: "pnpm --filter beads-server dev",
      portEnv: "BEADS_PORT",
      defaultPort: 4243,
    },
    {
      name: "agent-server",
      command: "pnpm --filter ralph-ui serve:agent",
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
