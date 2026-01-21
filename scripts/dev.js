#!/usr/bin/env node
/**
 * Development script that finds an available port and starts both server and UI.
 */
import { createServer } from "node:net"
import { spawn } from "node:child_process"

const DEFAULT_SERVER_PORT = 4242
const DEFAULT_UI_PORT = 5179
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
  const requestedServerPort = process.env.PORT ? Number(process.env.PORT) : undefined
  const requestedUiPort = process.env.RALPH_UI_PORT ? Number(process.env.RALPH_UI_PORT) : undefined
  const serverPort =
    requestedServerPort ?? (await findAvailablePort(DEFAULT_SERVER_PORT))
  const uiPort = requestedUiPort ?? (await findAvailablePort(DEFAULT_UI_PORT))

  if (requestedServerPort !== undefined && !(await checkPortAvailable(requestedServerPort))) {
    throw new Error(`Server port ${requestedServerPort} is already in use`)
  }
  if (requestedUiPort !== undefined && !(await checkPortAvailable(requestedUiPort))) {
    throw new Error(`UI port ${requestedUiPort} is already in use`)
  }
  console.log(`[dev] Server port ${serverPort}`)
  console.log(`[dev] UI port ${uiPort}`)

  const env = { ...process.env, PORT: String(serverPort), RALPH_UI_PORT: String(uiPort) }

  // Start server
  const server = spawn("pnpm", ["serve"], {
    stdio: "inherit",
    env,
  })

  // Wait a moment for server to start, then start UI
  await new Promise(resolve => setTimeout(resolve, 1000))

  const uiArgs = [
    "--filter",
    "@herbcaudill/ralph-ui",
    "exec",
    "vite",
    "--port",
    String(uiPort),
  ]
  if (!process.env.RALPH_NO_OPEN) {
    uiArgs.push("--open")
  }
  const ui = spawn(
    "pnpm",
    uiArgs,
    {
      stdio: "inherit",
      env,
    },
  )

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
