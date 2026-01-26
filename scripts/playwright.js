#!/usr/bin/env node
/**  Runs Playwright with dynamic server/UI ports, using scripts/dev.js to start services. */
import { spawn, execSync } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const DEV_SERVER_PORT = 4242 // Default port used by `pnpm dev`
const DEV_UI_PORT = 5179 // Default Vite port used by `pnpm dev`
const TEST_SERVER_START_PORT = 4243 // Start searching for test server port here
const TEST_UI_START_PORT = 5180 // Start searching for test UI port here
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

  // Check if dev server is already running - this can cause test pollution
  // if a user accidentally interacts with the dev UI while tests are running
  const devServerRunning = !(await checkPortAvailable(DEV_SERVER_PORT))
  const devUiRunning = !(await checkPortAvailable(DEV_UI_PORT))

  if (devServerRunning || devUiRunning) {
    console.error("\x1b[31m" + "⚠️  WARNING: Ralph dev server appears to be running!" + "\x1b[0m")
    console.error("")
    console.error("   E2E tests use an isolated test workspace, but if you interact")
    console.error("   with the dev server UI while tests are running, tasks will be")
    console.error("   created in your main repo instead of the test workspace.")
    console.error("")
    console.error("   To avoid pollution of your main repo's task database:")
    console.error("   • Stop the dev server (Ctrl+C on `pnpm dev`)")
    console.error("   • Or avoid interacting with the Ralph UI during tests")
    console.error("")
    console.error("   Continuing with tests in 3 seconds...")
    console.error("")
    await delay(3000)
  }

  const serverPort = await findAvailablePort(TEST_SERVER_START_PORT)
  const uiPort = await findAvailablePort(TEST_UI_START_PORT)
  const baseURL = `http://localhost:${uiPort}`

  await mkdir(logDir, { recursive: true })
  const devLogStream = createWriteStream(devLogPath, { flags: "w" })

  // Create env without FORCE_COLOR and suppress Node warnings to avoid
  // "NO_COLOR ignored due to FORCE_COLOR" warnings from Playwright workers
  const { FORCE_COLOR: _, ...baseEnv } = process.env
  const env = {
    ...baseEnv,
    PORT: String(serverPort),
    RALPH_UI_PORT: String(uiPort),
    WORKSPACE_PATH: testWorkspacePath,
    PW_BASE_URL: baseURL,
    RALPH_NO_OPEN: "1",
    NO_COLOR: "1", // Suppress ANSI color codes
    NODE_NO_WARNINGS: "1", // Suppress Node.js warnings from Playwright workers
    // RALPH_QUIET is inherited from parent process if set (e.g., when run by Ralph)
    // playwright.config.ts checks CI || RALPH_QUIET to determine reporter
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
    // Stop the bd daemon for the test workspace to clean up registry entry
    try {
      execSync(`bd daemon stop "${testWorkspacePath}"`, { stdio: "pipe" })
    } catch {
      // Daemon may not be running, that's fine
    }
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
