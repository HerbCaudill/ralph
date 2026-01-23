#!/usr/bin/env node
import { Command } from "commander"
import { spawn, exec } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const PID_DIR = join(homedir(), ".ralph-ui")
const PID_FILE = join(PID_DIR, "server.pid")
const LOG_FILE = join(PID_DIR, "server.log")

function ensurePidDir() {
  if (!existsSync(PID_DIR)) {
    mkdirSync(PID_DIR, { recursive: true })
  }
}

function getPid() {
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10)
    // Check if process is actually running
    try {
      process.kill(pid, 0)
      return pid
    } catch {
      // Process not running, clean up stale PID file
      unlinkSync(PID_FILE)
      return null
    }
  }
  return null
}

function savePid(pid) {
  ensurePidDir()
  writeFileSync(PID_FILE, String(pid))
}

function removePid() {
  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE)
  }
}

function openBrowser(url) {
  const platform = process.platform
  const cmd =
    platform === "darwin" ? "open"
    : platform === "win32" ? "start"
    : "xdg-open"
  exec(`${cmd} ${url}`)
}

async function startServer(options) {
  const existingPid = getPid()
  if (existingPid) {
    console.log(`[ralph-ui] Server already running (PID: ${existingPid})`)
    if (options.open) {
      const url = `http://${options.host}:${options.port}`
      openBrowser(url)
    }
    return
  }

  ensurePidDir()

  // Build environment variables for the server
  const env = {
    ...process.env,
    HOST: options.host,
    PORT: String(options.port),
    LOG_RALPH_EVENTS: options.logEvents ? "true" : "",
  }

  // Path to the server entry point
  const serverPath = join(__filename, "..", "..", "dist", "server", "main.js")

  // Spawn detached process
  const child = spawn("node", [serverPath], {
    detached: true,
    stdio: options.debug ? "inherit" : "ignore",
    env,
  })

  child.unref()
  savePid(child.pid)

  const url = `http://${options.host}:${options.port}`
  console.log(`[ralph-ui] Server started (PID: ${child.pid})`)
  console.log(`[ralph-ui] Running at ${url}`)

  if (options.open) {
    // Wait a moment for server to start
    setTimeout(() => openBrowser(url), 500)
  }
}

function stopServer() {
  const pid = getPid()
  if (!pid) {
    console.log("[ralph-ui] Server is not running")
    return false
  }

  try {
    process.kill(pid, "SIGTERM")
    removePid()
    console.log(`[ralph-ui] Server stopped (PID: ${pid})`)
    return true
  } catch (err) {
    console.error(`[ralph-ui] Failed to stop server: ${err.message}`)
    removePid()
    return false
  }
}

async function restartServer(options) {
  stopServer()
  // Wait a moment for port to be released
  await new Promise(resolve => setTimeout(resolve, 500))
  await startServer(options)
}

// CLI
const program = new Command()

program
  .name("ralph-ui")
  .description("Web UI for Ralph - autonomous AI iteration engine")
  .version("0.8.4")

program
  .command("start")
  .description("Start the UI server")
  .option("-d, --debug", "Enable debug logging (run in foreground)")
  .option("--open", "Open the browser after starting")
  .option("--host <addr>", "Bind to a specific host", "127.0.0.1")
  .option("--port <num>", "Bind to a specific port", "4242")
  .option("--log-events", "Log ralph process events to console")
  .action(options => {
    startServer({
      debug: options.debug || false,
      open: options.open || false,
      host: options.host,
      port: parseInt(options.port, 10),
      logEvents: options.logEvents || false,
    })
  })

program
  .command("stop")
  .description("Stop the UI server")
  .action(() => {
    stopServer()
  })

program
  .command("restart")
  .description("Restart the UI server")
  .option("-d, --debug", "Enable debug logging (run in foreground)")
  .option("--open", "Open the browser after restarting")
  .option("--host <addr>", "Bind to a specific host", "127.0.0.1")
  .option("--port <num>", "Bind to a specific port", "4242")
  .option("--log-events", "Log ralph process events to console")
  .action(options => {
    restartServer({
      debug: options.debug || false,
      open: options.open || false,
      host: options.host,
      port: parseInt(options.port, 10),
      logEvents: options.logEvents || false,
    })
  })

program
  .command("status")
  .description("Check if the server is running")
  .action(() => {
    const pid = getPid()
    if (pid) {
      console.log(`[ralph-ui] Server is running (PID: ${pid})`)
    } else {
      console.log("[ralph-ui] Server is not running")
    }
  })

// Default to showing help if no command provided
if (process.argv.length < 3) {
  program.help()
}

program.parse()
