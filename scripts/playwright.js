#!/usr/bin/env node
/**
 * Runs Playwright with dynamic server/UI ports, using scripts/dev.js to start services.
 */
import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const DEFAULT_SERVER_PORT = 4242
const DEFAULT_UI_PORT = 5179
const MAX_ATTEMPTS = 10
const WAIT_TIMEOUT_MS = 30000
const WAIT_INTERVAL_MS = 250

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const testWorkspacePath = path.join(repoRoot, "ui", "e2e", "test-workspace")
const logDir = path.join(repoRoot, "ui", "test-results")
const devLogPath = path.join(logDir, "playwright-dev.log")

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
  }
  throw new Error(`No available port found after ${MAX_ATTEMPTS} attempts`)
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Keep retrying until timeout.
    }
    await delay(WAIT_INTERVAL_MS)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function runPlaywright(args, env) {
  return new Promise(resolve => {
    const child = spawn(
      "pnpm",
      ["--filter", "@herbcaudill/ralph-ui", "exec", "playwright", "test", ...args],
      {
        cwd: repoRoot,
        stdio: "inherit",
        env,
      },
    )

    child.on("exit", code => resolve(code ?? 1))
  })
}

async function main() {
  const args = process.argv.slice(2)
  const serverPort = await findAvailablePort(DEFAULT_SERVER_PORT)
  const uiPort = await findAvailablePort(DEFAULT_UI_PORT)
  const baseURL = `http://localhost:${uiPort}`

  await mkdir(logDir, { recursive: true })
  const devLogStream = createWriteStream(devLogPath, { flags: "w" })

  const env = {
    ...process.env,
    PORT: String(serverPort),
    RALPH_UI_PORT: String(uiPort),
    WORKSPACE_PATH: testWorkspacePath,
    PW_BASE_URL: baseURL,
    RALPH_NO_OPEN: "1",
    PW_QUIET: "1", // Use dot reporter for minimal output
  }

  const devProcess = spawn("node", ["scripts/dev.js"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  })
  devProcess.stdout?.pipe(devLogStream)
  devProcess.stderr?.pipe(devLogStream)

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) {
      return
    }
    cleanedUp = true
    devProcess.kill("SIGTERM")
  }

  process.on("SIGINT", () => {
    cleanup()
    process.exit(1)
  })
  process.on("SIGTERM", () => {
    cleanup()
    process.exit(1)
  })

  try {
    await waitForUrl(`http://localhost:${serverPort}/healthz`, WAIT_TIMEOUT_MS)
    await waitForUrl(baseURL, WAIT_TIMEOUT_MS)
    const exitCode = await runPlaywright(args, env)
    devLogStream.end()
    cleanup()
    process.exit(exitCode)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[pw] Error: ${message}`)
    console.error(`[pw] Dev server logs: ${devLogPath}`)
    devLogStream.end()
    cleanup()
    process.exit(1)
  }
}

main()
