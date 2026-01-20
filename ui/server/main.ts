/**
 * Development entry point for the server.
 * This file auto-starts the server when run with tsx.
 */
import { startServer, getConfig, findAvailablePort } from "./index.js"

async function main() {
  try {
    const config = getConfig()
    const availablePort = await findAvailablePort(config.host, config.port)
    if (availablePort !== config.port) {
      process.env.PORT = String(availablePort)
      config.port = availablePort
    }
    await startServer(config)
  } catch (err) {
    console.error("[server] startup error:", err)
    process.exitCode = 1
  }
}

main()
