/**
 * Ensure the Dolt SQL server is running for the beads database.
 *
 * Checks if a Dolt server is reachable on the configured port (default 3307).
 * If not, spawns `dolt sql-server` as a detached background process using the
 * workspace's `.beads/dolt/` directory as its data dir.
 */
import { execFileSync, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import net from "node:net"

const DEFAULT_PORT = 3307
const DEFAULT_HOST = "127.0.0.1"
const STARTUP_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 200

/** Check if a TCP port is accepting connections. */
function isPortReachable(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(500)
    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/** Read the Dolt port from beads metadata/config, falling back to 3307. */
function getDoltPort(workspacePath) {
  try {
    const output = execFileSync("bd", ["dolt", "show", "--json"], {
      cwd: workspacePath,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).toString()
    const config = JSON.parse(output)
    return config.port ?? DEFAULT_PORT
  } catch {
    return DEFAULT_PORT
  }
}

/**
 * Ensure the Dolt SQL server is running for the given workspace.
 * Starts it as a background process if not already running.
 */
export async function ensureDoltServer(workspacePath) {
  const doltDataDir = path.join(workspacePath, ".beads", "dolt")
  if (!existsSync(doltDataDir)) {
    console.log("   ⚠ no .beads/dolt/ directory found, skipping Dolt startup")
    return
  }

  const port = getDoltPort(workspacePath)

  // Check if already running
  if (await isPortReachable(DEFAULT_HOST, port)) {
    console.log(`   ✔︎ dolt sql-server (port ${port})`)
    return
  }

  // Start Dolt SQL server as a detached background process
  console.log(`   ⏳ starting dolt sql-server on port ${port}...`)
  const proc = spawn("dolt", ["sql-server", "--port", String(port)], {
    cwd: doltDataDir,
    stdio: "ignore",
    detached: true,
  })
  proc.unref()

  // Wait for it to become reachable
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isPortReachable(DEFAULT_HOST, port)) {
      console.log(`   ✔︎ dolt sql-server (port ${port})`)
      return
    }
    await delay(POLL_INTERVAL_MS)
  }

  throw new Error(`Dolt SQL server failed to start on port ${port} within ${STARTUP_TIMEOUT_MS / 1000}s`)
}
