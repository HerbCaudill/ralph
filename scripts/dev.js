#!/usr/bin/env node
/**
 * Development script that finds an available port and starts both server and UI.
 */
import { createServer } from "node:net"
import { spawn } from "node:child_process"

const DEFAULT_PORT = 4242
const MAX_ATTEMPTS = 10

async function checkPortAvailable(port) {
  return new Promise(resolve => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.listen(port, "localhost", () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort(startPort) {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const port = startPort + i
    if (await checkPortAvailable(port)) {
      return port
    }
    console.log(`[dev] Port ${port} in use, trying ${port + 1}...`)
  }
  throw new Error(`No available port found after ${MAX_ATTEMPTS} attempts`)
}

async function main() {
  const port = await findAvailablePort(DEFAULT_PORT)
  console.log(`[dev] Using port ${port}`)

  const env = { ...process.env, PORT: String(port) }

  // Start server
  const server = spawn("pnpm", ["serve"], {
    stdio: "inherit",
    env,
    shell: true,
  })

  // Wait a moment for server to start, then start UI
  await new Promise(resolve => setTimeout(resolve, 1000))

  const ui = spawn("pnpm", ["ui"], {
    stdio: "inherit",
    env,
    shell: true,
  })

  // Handle cleanup
  const cleanup = () => {
    server.kill()
    ui.kill()
    process.exit()
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  // Exit if either process exits
  server.on("exit", code => {
    console.log(`[dev] Server exited with code ${code}`)
    ui.kill()
    process.exit(code ?? 1)
  })

  ui.on("exit", code => {
    console.log(`[dev] UI exited with code ${code}`)
    server.kill()
    process.exit(code ?? 1)
  })
}

main().catch(err => {
  console.error("[dev] Error:", err.message)
  process.exit(1)
})
