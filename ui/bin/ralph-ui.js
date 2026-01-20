#!/usr/bin/env node
import { startServer, getConfig, findAvailablePort } from "../dist/server/index.js"
import { exec } from "node:child_process"

function openBrowser(url) {
  const platform = process.platform
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"

  exec(`${cmd} ${url}`, err => {
    if (err) {
      console.log(`[server] Open ${url} in your browser`)
    }
  })
}

async function main() {
  try {
    const config = getConfig()
    const availablePort = await findAvailablePort(config.host, config.port)
    if (availablePort !== config.port) {
      process.env.PORT = String(availablePort)
      config.port = availablePort
    }
    await startServer(config)

    // Open browser after server starts
    const url = `http://${config.host}:${config.port}`
    openBrowser(url)
  } catch (err) {
    console.error("[server] startup error:", err)
    process.exitCode = 1
  }
}

main()
