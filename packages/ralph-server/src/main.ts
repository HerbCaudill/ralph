/**
 * Development entry point for the ralph server.
 * This file auto-starts the server when run with tsx.
 */
import { startServer, getConfig } from "./index.js"

async function main() {
  try {
    await startServer(getConfig())
  } catch (err) {
    console.error("[ralph-server] startup error:", err)
    process.exitCode = 1
  }
}

main()
