/**
 * Wrapper entry point that starts the agent-server with Ralph-specific routes.
 * Run this instead of agent-server's main.ts to get `/api/prompts/ralph`.
 */
import { startServer, getConfig } from "@herbcaudill/agent-server"
import { registerRalphRoutes } from "./ralphRoutes.js"

async function main() {
  try {
    const config = getConfig()
    await startServer({ ...config, customRoutes: registerRalphRoutes })
  } catch (err) {
    console.error("[agent-server] startup error:", err)
    process.exitCode = 1
  }
}

main()
