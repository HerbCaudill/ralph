#!/usr/bin/env node
/** Development script that finds available ports and starts both server and UI. */
import { runDev } from "./lib/devRunner.js"

runDev({
  label: "dev",
  services: [{ name: "server", command: "pnpm serve", portEnv: "PORT", defaultPort: 4242 }],
  frontend: {
    package: "@herbcaudill/ralph-ui",
    portEnv: "RALPH_UI_PORT",
    defaultPort: 5179,
    open: true,
  },
  env: { WORKSPACE_PATH: process.env.WORKSPACE_PATH ?? process.cwd() },
}).catch(err => {
  console.error("[dev] Error:", err.message)
  process.exit(1)
})
