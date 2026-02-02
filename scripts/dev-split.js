#!/usr/bin/env node
/**
 * Development script that runs beads-server + agent-server + UI as separate processes.
 *
 * This is the "split server" alternative to dev.js (which runs the combined server).
 * Each server gets its own port and the Vite dev proxy routes requests accordingly.
 *
 * Environment variables:
 *   BEADS_PORT       - Port for beads-server   (default: 4243)
 *   AGENT_SERVER_PORT - Port for agent-server  (default: 4244)
 *   RALPH_UI_PORT    - Port for the Vite UI    (default: 5179)
 *   WORKSPACE_PATH   - Workspace root          (default: cwd)
 *   RALPH_NO_OPEN    - Set to skip auto-opening browser
 */
import { createServer } from "node:net"
import { spawn } from "node:child_process"

const DEFAULT_BEADS_PORT = 4243
const DEFAULT_AGENT_PORT = 4244
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
    console.log(`[dev-split] Port ${port} in use, trying ${port + 1}...`)
  }
  throw new Error(`No available port found after ${MAX_ATTEMPTS} attempts`)
}

async function resolvePort(envVar, defaultPort, label) {
  const requested = process.env[envVar] ? Number(process.env[envVar]) : undefined
  if (requested !== undefined) {
    if (!(await checkPortAvailable(requested))) {
      throw new Error(`${label} port ${requested} is already in use`)
    }
    return requested
  }
  return findAvailablePort(defaultPort)
}

async function main() {
  const beadsPort = await resolvePort("BEADS_PORT", DEFAULT_BEADS_PORT, "Beads server")
  const agentPort = await resolvePort("AGENT_SERVER_PORT", DEFAULT_AGENT_PORT, "Agent server")
  const uiPort = await resolvePort("RALPH_UI_PORT", DEFAULT_UI_PORT, "UI")

  const workspacePath = process.env.WORKSPACE_PATH ?? process.cwd()

  console.log(`[dev-split] Beads server  → http://localhost:${beadsPort}`)
  console.log(`[dev-split] Agent server  → http://localhost:${agentPort}`)
  console.log(`[dev-split] UI            → http://localhost:${uiPort}`)
  console.log(`[dev-split] Workspace     → ${workspacePath}`)

  const baseEnv = {
    ...process.env,
    WORKSPACE_PATH: workspacePath,
  }

  // Start beads-server
  const beads = spawn("pnpm", ["--filter", "@herbcaudill/beads-server", "dev"], {
    stdio: "inherit",
    env: { ...baseEnv, BEADS_PORT: String(beadsPort) },
  })

  // Start agent-server
  const agent = spawn("pnpm", ["--filter", "@herbcaudill/agent-server", "dev"], {
    stdio: "inherit",
    env: { ...baseEnv, AGENT_SERVER_PORT: String(agentPort) },
  })

  // Wait for servers to start before launching UI
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Start Vite UI with split-server env vars so the proxy routes correctly
  const uiArgs = ["--filter", "@herbcaudill/ralph-ui", "exec", "vite", "--port", String(uiPort)]
  if (!process.env.RALPH_NO_OPEN) {
    uiArgs.push("--open")
  }
  const ui = spawn("pnpm", uiArgs, {
    stdio: "inherit",
    env: {
      ...baseEnv,
      BEADS_PORT: String(beadsPort),
      AGENT_SERVER_PORT: String(agentPort),
      VITE_SPLIT_SERVERS: "true",
    },
  })

  const processes = [
    { name: "beads-server", proc: beads },
    { name: "agent-server", proc: agent },
    { name: "ui", proc: ui },
  ]

  // Handle cleanup
  const cleanup = () => {
    for (const { proc } of processes) proc.kill()
    process.exit()
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  // Exit if any process exits
  for (const { name, proc } of processes) {
    proc.on("exit", code => {
      console.log(`[dev-split] ${name} exited with code ${code}`)
      for (const { name: n, proc: p } of processes) {
        if (n !== name) p.kill()
      }
      process.exit(code ?? 1)
    })
  }
}

main().catch(err => {
  console.error("[dev-split] Error:", err.message)
  process.exit(1)
})
