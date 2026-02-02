#!/usr/bin/env node
/** Runs Playwright with dynamic server/UI ports, using scripts/dev.js to start services. */
import { spawn, execSync } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"
import { checkPortAvailable, findAvailablePort, waitForUrl } from "./lib/devRunner.js"

const DEV_SERVER_PORT = 4242
const DEV_UI_PORT = 5179
const TEST_SERVER_START_PORT = 4243
const TEST_UI_START_PORT = 5180
const WAIT_TIMEOUT_MS = 30_000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const testWorkspacePath = path.join(repoRoot, "packages", "ui", "e2e", "test-workspace")
const logDir = path.join(repoRoot, "packages", "ui", "test-results")
const devLogPath = path.join(logDir, "playwright-dev.log")

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
  const devServerRunning = !(await checkPortAvailable(DEV_SERVER_PORT))
  const devUiRunning = !(await checkPortAvailable(DEV_UI_PORT))

  const quiet = !!(process.env.CI || process.env.RALPH_QUIET || process.env.PW_QUIET)
  if ((devServerRunning || devUiRunning) && !quiet) {
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
    NO_COLOR: "1",
    NODE_NO_WARNINGS: "1",
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
    if (cleanedUp) return
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
