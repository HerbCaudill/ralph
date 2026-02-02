import express, { type Express, type Request, type Response } from "express"
import { createServer, type Server } from "node:http"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { WebSocketServer, type WebSocket, type RawData } from "ws"
import { BdProxy } from "./BdProxy.js"
import { registerTaskRoutes } from "@herbcaudill/beads-view/server"
import { getAliveWorkspaces } from "./getAliveWorkspaces.js"
import { watchMutations } from "./BeadsClient.js"
import type { MutationEvent } from "@herbcaudill/beads-sdk"
import type { BeadsServerConfig, WsClient } from "./types.js"

export type { BeadsServerConfig, WsClient } from "./types.js"
export type { RegistryEntry, WorkspaceInfo } from "./types.js"
export { BdProxy } from "./BdProxy.js"
export { BeadsClient, watchMutations } from "./BeadsClient.js"
export { getAliveWorkspaces } from "./getAliveWorkspaces.js"
export { getAvailableWorkspaces } from "./getAvailableWorkspaces.js"
export { readRegistry } from "./readRegistry.js"
export { getRegistryPath } from "./getRegistryPath.js"
export { isProcessRunning } from "./isProcessRunning.js"

const execFileAsync = promisify(execFile)

// Module state

/** Active BdProxy instance for the current workspace. */
let bdProxy: BdProxy | null = null

/** Current workspace path. */
let currentWorkspacePath: string | undefined

/** Cleanup function for the mutation watcher. */
let stopMutationWatcher: (() => void) | null = null

/** Connected WebSocket clients. */
const wsClients = new Set<WsClient>()

// Helpers

/**
 * Get the current git branch name for a workspace.
 * Returns null if not a git repo or on any error.
 */
export async function getGitBranch(workspacePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: workspacePath,
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

/**
 * Read the peacock accent color from .vscode/settings.json in the workspace.
 * Returns null if not found or on any error.
 */
export async function readPeacockColor(workspacePath: string): Promise<string | null> {
  try {
    const settingsPath = path.join(workspacePath, ".vscode", "settings.json")
    const content = await readFile(settingsPath, "utf-8")
    const settings = JSON.parse(content) as { "peacock.color"?: string }
    return settings["peacock.color"] ?? null
  } catch {
    return null
  }
}

/** Get or create the BdProxy for the current workspace. */
function getBdProxy(): BdProxy {
  if (!bdProxy) {
    const workspacePath = currentWorkspacePath || process.cwd()
    bdProxy = new BdProxy({ cwd: workspacePath })
  }
  return bdProxy
}

/**
 * Switch to a different workspace.
 * Creates a new BdProxy and restarts mutation polling.
 */
async function switchWorkspace(
  workspacePath: string,
  config: { enableMutationPolling?: boolean; mutationPollingInterval?: number },
): Promise<void> {
  // Stop existing mutation watcher
  if (stopMutationWatcher) {
    stopMutationWatcher()
    stopMutationWatcher = null
  }

  // Update workspace
  currentWorkspacePath = workspacePath
  bdProxy = new BdProxy({ cwd: workspacePath })

  // Restart mutation polling
  if (config.enableMutationPolling !== false) {
    startMutationPolling(config.mutationPollingInterval)
  }
}

// Mutation polling

/** Start polling the beads daemon for mutation events and broadcast them via WebSocket. */
function startMutationPolling(interval: number = 1000): void {
  if (stopMutationWatcher) {
    stopMutationWatcher()
  }

  const workspacePath = currentWorkspacePath || process.cwd()
  stopMutationWatcher = watchMutations(
    (event: MutationEvent) => {
      broadcast({
        type: "mutation:event",
        event,
        timestamp: Date.now(),
      })
    },
    { workspacePath, interval },
  )
}

// WebSocket

/** Broadcast a message to all connected WebSocket clients. */
function broadcast(message: Record<string, unknown>): void {
  const data = JSON.stringify(message)
  for (const client of wsClients) {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(data)
    }
  }
}

/** Broadcast a message to clients subscribed to a specific workspace. */
function broadcastToWorkspace(workspaceId: string, message: Record<string, unknown>): void {
  const data = JSON.stringify(message)
  for (const client of wsClients) {
    if (client.ws.readyState !== client.ws.OPEN) continue
    // Send to clients subscribed to this workspace, or to all if no subscriptions
    if (client.subscribedWorkspaces.size === 0 || client.subscribedWorkspaces.has(workspaceId)) {
      client.ws.send(data)
    }
  }
}

/** Attach a WebSocket server to the HTTP server. */
function attachWsServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" })

  wss.on("connection", (ws: WebSocket) => {
    const client: WsClient = { ws, subscribedWorkspaces: new Set() }
    wsClients.add(client)

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        server: "beads-server",
        workspace: currentWorkspacePath,
        timestamp: Date.now(),
      }),
    )

    ws.on("message", (raw: RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as { type: string; workspaceId?: string }

        switch (message.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
            break

          case "ws:subscribe_workspace":
            if (message.workspaceId) {
              client.subscribedWorkspaces.add(message.workspaceId)
              ws.send(
                JSON.stringify({
                  type: "ws:subscribed",
                  workspaceId: message.workspaceId,
                  timestamp: Date.now(),
                }),
              )
            }
            break

          default:
            // Unknown message type — ignore
            break
        }
      } catch {
        // Invalid JSON — ignore
      }
    })

    ws.on("close", () => {
      wsClients.delete(client)
    })

    ws.on("error", () => {
      wsClients.delete(client)
    })
  })
}

// Server config

/** Build a default server configuration from environment variables. */
export function getConfig(): BeadsServerConfig {
  return {
    host: process.env.BEADS_HOST || process.env.HOST || "localhost",
    port: parseInt(process.env.BEADS_PORT || process.env.PORT || "4243", 10),
    workspacePath: process.env.WORKSPACE_PATH || process.cwd(),
    enableMutationPolling: process.env.BEADS_DISABLE_POLLING !== "true",
    mutationPollingInterval: parseInt(process.env.BEADS_POLL_INTERVAL || "1000", 10),
  }
}

// Express app

/** Create an Express application with all beads API endpoints configured. */
function createApp(config: BeadsServerConfig): Express {
  const app = express()

  // Disable x-powered-by header
  app.disable("x-powered-by")

  // Parse JSON bodies
  app.use(express.json())

  // Health
  app.get("/healthz", (_req: Request, res: Response) => {
    res.type("application/json")
    res.status(200).json({ ok: true, server: "beads-server" })
  })

  // Workspace info
  app.get("/api/workspace", async (_req: Request, res: Response) => {
    try {
      const proxy = getBdProxy()
      const info = await proxy.getInfo()

      // Extract workspace path from database_path (remove .beads/beads.db suffix)
      const workspacePath = info.database_path.replace(/\/.beads\/beads\.db$/, "")

      // Read peacock accent color and git branch in parallel
      const [accentColor, branch] = await Promise.all([
        readPeacockColor(workspacePath),
        getGitBranch(workspacePath),
      ])

      // Get count of open + in_progress issues (active issues)
      let activeIssueCount: number | undefined
      try {
        const [openIssues, inProgressIssues] = await Promise.all([
          proxy.list({ status: "open", limit: 0 }),
          proxy.list({ status: "in_progress", limit: 0 }),
        ])
        activeIssueCount = openIssues.length + inProgressIssues.length
      } catch {
        // If we can't get issue count, leave it undefined
      }

      // Extract issue prefix from config
      const issuePrefix = info.config?.issue_prefix ?? null

      res.status(200).json({
        ok: true,
        workspace: {
          path: workspacePath,
          name: workspacePath.split("/").pop() || workspacePath,
          issueCount: activeIssueCount,
          daemonConnected: info.daemon_connected,
          daemonStatus: info.daemon_status,
          accentColor,
          branch,
          issuePrefix,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get workspace info"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // List workspaces
  app.get("/api/workspaces", async (_req: Request, res: Response) => {
    try {
      const proxy = getBdProxy()
      let currentPath: string | undefined
      try {
        const info = await proxy.getInfo()
        currentPath = info.database_path.replace(/\/.beads\/beads\.db$/, "")
      } catch {
        // If we can't get current workspace, that's fine
      }

      const workspaces = getAliveWorkspaces(currentPath)

      // Add accent colors and active issue counts for each workspace
      const workspacesWithMetadata = await Promise.all(
        workspaces.map(async ws => {
          const accentColor = await readPeacockColor(ws.path)

          let activeIssueCount: number | undefined
          try {
            const wsProxy = new BdProxy({ cwd: ws.path })
            const [openIssues, inProgressIssues] = await Promise.all([
              wsProxy.list({ status: "open", limit: 0 }),
              wsProxy.list({ status: "in_progress", limit: 0 }),
            ])
            activeIssueCount = openIssues.length + inProgressIssues.length
          } catch {
            // If we can't get issue count, leave it undefined
          }

          return {
            ...ws,
            accentColor,
            activeIssueCount,
          }
        }),
      )

      res.status(200).json({
        ok: true,
        workspaces: workspacesWithMetadata,
        currentPath,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list workspaces"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Switch workspace
  app.post("/api/workspace/switch", async (req: Request, res: Response) => {
    try {
      const { path: workspacePath } = req.body as { path?: string }

      if (!workspacePath?.trim()) {
        res.status(400).json({ ok: false, error: "Workspace path is required" })
        return
      }

      // Switch the BdProxy to the new workspace
      await switchWorkspace(workspacePath, config)

      // Get info from the new workspace to confirm it works
      const proxy = getBdProxy()
      const info = await proxy.getInfo()

      // Read peacock accent color and git branch in parallel
      const [accentColor, branch] = await Promise.all([
        readPeacockColor(workspacePath),
        getGitBranch(workspacePath),
      ])

      // Get count of open + in_progress issues (active issues)
      let activeIssueCount: number | undefined
      try {
        const [openIssues, inProgressIssues] = await Promise.all([
          proxy.list({ status: "open", limit: 0 }),
          proxy.list({ status: "in_progress", limit: 0 }),
        ])
        activeIssueCount = openIssues.length + inProgressIssues.length
      } catch {
        // If we can't get issue count, leave it undefined
      }

      // Extract issue prefix from config
      const issuePrefix = info.config?.issue_prefix ?? null

      // Broadcast workspace switch to all clients
      broadcast({
        type: "workspace_switched",
        workspace: {
          path: workspacePath,
          name: workspacePath.split("/").pop(),
          issueCount: activeIssueCount,
          daemonConnected: info.daemon_connected,
          daemonStatus: info.daemon_status,
          accentColor,
          branch,
          issuePrefix,
        },
        timestamp: Date.now(),
      })

      res.status(200).json({
        ok: true,
        workspace: {
          path: workspacePath,
          name: workspacePath.split("/").pop(),
          issueCount: activeIssueCount,
          daemonConnected: info.daemon_connected,
          daemonStatus: info.daemon_status,
          accentColor,
          branch,
          issuePrefix,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch workspace"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // ── Task management (delegated to @herbcaudill/beads-view) ────────
  registerTaskRoutes({ app, getBdProxy })

  return app
}

// Port checking

/** Check if a port is available for listening. */
function checkPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const testServer = createServer()
    testServer.once("error", () => {
      resolve(false)
    })
    testServer.listen(port, host, () => {
      testServer.close(() => {
        resolve(true)
      })
    })
  })
}

/** Find the first available port starting from the given port. */
export async function findAvailablePort(
  host: string,
  startPort: number,
  maxAttempts = 10,
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt
    const available = await checkPortAvailable(host, port)
    if (available) {
      return port
    }
    console.log(`[beads-server] port ${port} in use, trying ${port + 1}`)
  }
  throw new Error(
    `No available port found after ${maxAttempts} attempts starting from ${startPort}`,
  )
}

// Graceful shutdown

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[beads-server] Received ${signal}, shutting down gracefully...`)

  // Stop mutation polling
  if (stopMutationWatcher) {
    stopMutationWatcher()
    stopMutationWatcher = null
  }

  // Close all WebSocket connections
  for (const client of wsClients) {
    client.ws.close()
  }
  wsClients.clear()

  console.log("[beads-server] Shutdown complete")
  process.exit(0)
}

// Start server

/** Start the beads server with the given configuration. */
export async function startServer(config: BeadsServerConfig): Promise<Server> {
  // Set workspace path
  currentWorkspacePath = config.workspacePath

  if (currentWorkspacePath) {
    console.log(`[beads-server] Using workspace: ${currentWorkspacePath}`)
  }

  // Create BdProxy for the initial workspace
  bdProxy = new BdProxy({ cwd: currentWorkspacePath || process.cwd() })

  // Start mutation polling if enabled
  if (config.enableMutationPolling !== false) {
    startMutationPolling(config.mutationPollingInterval)
    console.log(
      `[beads-server] Mutation polling enabled (interval: ${config.mutationPollingInterval ?? 1000}ms)`,
    )
  }

  const app = createApp(config)
  const server = createServer(app)

  attachWsServer(server)

  server.on("error", err => {
    console.error("[beads-server] error:", err)
    process.exitCode = 1
  })

  return new Promise(resolve => {
    server.listen(config.port, config.host, () => {
      console.log(`[beads-server] running at http://${config.host}:${config.port}`)
      console.log(`[beads-server] WebSocket available at ws://${config.host}:${config.port}/ws`)

      // Register signal handlers for graceful shutdown
      process.on("SIGINT", () => gracefulShutdown("SIGINT"))
      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

      resolve(server)
    })
  })
}
