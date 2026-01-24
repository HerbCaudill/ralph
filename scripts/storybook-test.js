#!/usr/bin/env node
/**
 * Runs Storybook tests by starting a Storybook server, waiting for it to be ready,
 * running the test-storybook command, and cleaning up.
 */
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const DEFAULT_PORT = 6006
const MAX_PORT_ATTEMPTS = 10
const WAIT_TIMEOUT_MS = 60000
const WAIT_INTERVAL_MS = 500

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")

/**
 * Check if a port is available for binding.
 */
async function checkPortAvailable(port) {
  return new Promise(resolve => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.listen(port, "localhost", () => {
      server.close(() => resolve(true))
    })
  })
}

/**
 * Find an available port starting from the given port.
 */
async function findAvailablePort(startPort) {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = startPort + i
    if (await checkPortAvailable(port)) {
      return port
    }
  }
  throw new Error(`No available port found after ${MAX_PORT_ATTEMPTS} attempts`)
}

/**
 * Wait for a URL to respond with a successful status.
 */
async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Keep retrying until timeout
    }
    await delay(WAIT_INTERVAL_MS)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

/**
 * Run the test-storybook command.
 */
async function runTestStorybook(port) {
  return new Promise(resolve => {
    const child = spawn(
      "pnpm",
      ["--filter", "@herbcaudill/ralph-ui", "exec", "test-storybook", "--url", `http://127.0.0.1:${port}`],
      {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
      },
    )
    child.on("exit", code => resolve(code ?? 1))
  })
}

async function main() {
  const port = await findAvailablePort(DEFAULT_PORT)
  const storybookUrl = `http://127.0.0.1:${port}`

  console.log(`[storybook-test] Starting Storybook on port ${port}...`)

  const storybookProcess = spawn(
    "pnpm",
    ["--filter", "@herbcaudill/ralph-ui", "storybook", "--ci", "-p", String(port)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  )

  // Suppress Storybook output unless there's an error
  let stderrBuffer = ""
  storybookProcess.stderr?.on("data", chunk => {
    stderrBuffer += chunk.toString()
  })

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    storybookProcess.kill("SIGTERM")
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
    await waitForUrl(storybookUrl, WAIT_TIMEOUT_MS)
    console.log(`[storybook-test] Storybook ready, running tests...`)

    const exitCode = await runTestStorybook(port)
    cleanup()
    process.exit(exitCode)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[storybook-test] Error: ${message}`)
    if (stderrBuffer) {
      console.error(`[storybook-test] Storybook stderr:\n${stderrBuffer}`)
    }
    cleanup()
    process.exit(1)
  }
}

main()
