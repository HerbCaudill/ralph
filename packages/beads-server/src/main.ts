/**
 * Development entry point for the beads server.
 * This file auto-starts the server when run with tsx.
 */
import { startServer, getConfig, findAvailablePort } from "./index.js"

async function main() {
  try {
    const config = getConfig()
    const availablePort = await findAvailablePort(config.host, config.port)
    if (availablePort !== config.port) {
      config.port = availablePort
    }
    await startServer(config)
  } catch (err) {
    console.error("[beads-server] startup error:", err)
    process.exitCode = 1
  }
}

main()
