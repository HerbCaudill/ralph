import express, { type Express, type Request, type Response } from "express"
import { createServer, type Server } from "node:http"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { WebSocketServer, type WebSocket, type RawData } from "ws"
import {
  batched,
  MAX_CONCURRENT_REQUESTS,
  type MutationEvent,
  type Issue,
} from "@herbcaudill/beads-sdk"
import {
  BeadsClient,
  CliTransport,
  DaemonTransport,
  watchMutations,
  getAliveWorkspaces,
} from "@herbcaudill/beads-sdk/node"
import { existsSync } from "node:fs"
import { registerTaskRoutes } from "@herbcaudill/beads-view/server"
import { resolveWorkspacePath } from "./resolveWorkspacePath.js"
import { ThemeDiscovery } from "./ThemeDiscovery.js"
import {
  parseThemeObject,
  mapThemeToCSSVariables,
  createAppTheme,
} from "@herbcaudill/agent-view-theme"
import { WorkspaceNotFoundError, type BeadsServerConfig, type WsClient } from "./types.js"

export type { BeadsServerConfig, WsClient } from "./types.js"
export type { RegistryEntry, WorkspaceInfo } from "@herbcaudill/beads-sdk"
export { WorkspaceNotFoundError } from "./types.js"
export {
  BeadsClient,
  watchMutations,
  getAliveWorkspaces,
  getAvailableWorkspaces,
  readRegistry,
  getRegistryPath,
  isProcessRunning,
} from "@herbcaudill/beads-sdk/node"
export { resolveWorkspacePath } from "./resolveWorkspacePath.js"

const execFileAsync = promisify(execFile)

/**
 * Get workspaces from the daemon registry, falling back to `WORKSPACE_PATH` env var.
 * The daemon registry may be empty when using Dolt directly without a bd daemon.
 */
function discoverWorkspaces(): Array<{ path: string; name: string }> {
  const alive = getAliveWorkspaces()
  if (alive.length > 0) return alive

  // Fallback: use WORKSPACE_PATH if set and it has a .beads directory
  const workspacePath = process.env.WORKSPACE_PATH
  if (workspacePath && existsSync(path.join(workspacePath, ".beads"))) {
    return [{ path: workspacePath, name: path.basename(workspacePath) }]
  }

  return []
}

// Module state (no workspace state -- workspace is per-request)

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

/** Create a BeadsClient for the given workspace path. */
function getBeadsClient(workspace: string) {
  const resolved = resolveWorkspacePath(workspace)
  if (!resolved) {
    throw new WorkspaceNotFoundError(workspace)
  }

  // Use CliTransport (shells out to bd CLI) since the daemon was removed in bd v0.50.0
  const transport = new CliTransport(resolved, { actor: "beads-server" })

  return {
    async list(
      options: {
        limit?: number
        status?: string
        priority?: number
        type?: string
        assignee?: string
        parent?: string
        ready?: boolean
        all?: boolean
      } = {},
    ): Promise<Issue[]> {
      const args: Record<string, unknown> = {}
      if (options.limit) args.limit = options.limit
      if (options.status) args.status = options.status
      if (options.priority !== undefined) args.priority = options.priority
      if (options.type) args.issue_type = options.type
      if (options.assignee) args.assignee = options.assignee
      if (options.parent) args.parent = options.parent
      if (options.ready) args.ready = true
      if (options.all) args.all = true
      return (await transport.send("list", args)) as Issue[]
    },

    async blocked(parent?: string): Promise<Issue[]> {
      const args: Record<string, unknown> = {}
      if (parent) args.parent_id = parent
      return (await transport.send("blocked", args)) as Issue[]
    },

    async showOne(id: string): Promise<Issue> {
      return (await transport.send("show", { id })) as Issue
    },

    async show(ids: string | string[]): Promise<Issue[]> {
      const idList = Array.isArray(ids) ? ids : [ids]
      return batched(
        idList,
        MAX_CONCURRENT_REQUESTS,
        async (id: string) => (await transport.send("show", { id })) as Issue,
      )
    },

    async listWithParents(
      options: {
        status?: string
        ready?: boolean
        all?: boolean
        limit?: number
      } = {},
    ): Promise<Issue[]> {
      const issues = await this.list(options)
      if (issues.length === 0) return issues

      const idsNeedingDetail = issues
        .filter(
          (issue: Issue) => (issue.dependency_count ?? 0) > 0 || (issue.dependent_count ?? 0) > 0,
        )
        .map((issue: Issue) => issue.id)

      if (idsNeedingDetail.length === 0) return issues

      const detailedIssues = await this.show(idsNeedingDetail)
      const detailsMap = new Map<string, Issue>()
      for (const issue of detailedIssues) detailsMap.set(issue.id, issue)

      return issues.map((issue: Issue) => {
        const details = detailsMap.get(issue.id)
        if (!details) return issue
        const enriched: any = { ...issue }
        if (details.parent) enriched.parent = details.parent
        if (details.dependencies) {
          enriched.dependencies = details.dependencies
          const blockers = details.dependencies.filter(
            (dep: any) => dep.dependency_type === "blocks" && dep.status !== "closed",
          )
          if (blockers.length > 0) {
            enriched.blocked_by_count = blockers.length
            enriched.blocked_by = blockers.map((b: any) => b.id)
            if (enriched.status === "open") {
              enriched.status = "blocked"
            }
          }
        }
        return enriched
      })
    },

    async create(options: {
      title: string
      description?: string
      priority?: number
      type?: string
      assignee?: string
      parent?: string
      labels?: string[]
    }): Promise<Issue> {
      const args: Record<string, unknown> = { title: options.title }
      if (options.description) args.description = options.description
      if (options.priority !== undefined) args.priority = options.priority
      if (options.type) args.issue_type = options.type
      if (options.assignee) args.assignee = options.assignee
      if (options.parent) args.parent = options.parent
      if (options.labels?.length) args.labels = options.labels
      return (await transport.send("create", args)) as Issue
    },

    async update(
      ids: string | string[],
      options: {
        title?: string
        description?: string
        priority?: number
        status?: string
        type?: string
        assignee?: string
        parent?: string
        addLabels?: string[]
        removeLabels?: string[]
      },
    ): Promise<Issue[]> {
      const idList = Array.isArray(ids) ? ids : [ids]
      return batched(idList, MAX_CONCURRENT_REQUESTS, async (id: string) => {
        const args: Record<string, unknown> = { id }
        if (options.title) args.title = options.title
        if (options.description) args.description = options.description
        if (options.priority !== undefined) args.priority = options.priority
        if (options.status) args.status = options.status
        if (options.type) args.issue_type = options.type
        if (options.assignee) args.assignee = options.assignee
        if (options.parent !== undefined) args.parent = options.parent
        if (options.addLabels?.length) args.add_labels = options.addLabels
        if (options.removeLabels?.length) args.remove_labels = options.removeLabels
        return (await transport.send("update", args)) as Issue
      })
    },

    async delete(ids: string | string[]): Promise<void> {
      const idList = Array.isArray(ids) ? ids : [ids]
      await batched(idList, MAX_CONCURRENT_REQUESTS, async (id: string) => {
        await transport.send("delete", { id, force: true })
      })
    },

    async addComment(id: string, comment: string, author?: string): Promise<void> {
      const args: Record<string, unknown> = { id, text: comment }
      if (author) args.author = author
      await transport.send("comment_add", args)
    },

    async getComments(id: string): Promise<unknown[]> {
      return (await transport.send("comment_list", { id })) as unknown[]
    },

    async getInfo(): Promise<unknown> {
      return await transport.send("info", {})
    },

    async getLabels(id: string): Promise<string[]> {
      return (await transport.send("label_list", { id })) as string[]
    },

    async addLabel(id: string, label: string): Promise<unknown> {
      return await transport.send("label_add", { id, label })
    },

    async removeLabel(id: string, label: string): Promise<unknown> {
      return await transport.send("label_remove", { id, label })
    },

    async listAllLabels(): Promise<string[]> {
      return (await transport.send("label_list_all", {})) as string[]
    },

    async addBlocker(blockedId: string, blockerId: string): Promise<unknown> {
      return await transport.send("dep_add", {
        from_id: blockedId,
        to_id: blockerId,
      })
    },

    async removeBlocker(blockedId: string, blockerId: string): Promise<unknown> {
      return await transport.send("dep_remove", {
        from_id: blockedId,
        to_id: blockerId,
      })
    },
  }
}

// Mutation polling

/** Start polling all alive workspaces for mutation events and broadcast them via WebSocket. */
function startMutationPolling(interval: number = 1000): void {
  if (stopMutationWatcher) {
    stopMutationWatcher()
  }

  // Poll all discovered workspaces
  const workspaces = discoverWorkspaces()
  const cleanups: (() => void)[] = []

  for (const ws of workspaces) {
    const cleanup = watchMutations(
      (event: MutationEvent) => {
        broadcastToWorkspace(ws.path, {
          type: "mutation:event",
          event,
          workspace: ws.path,
          timestamp: Date.now(),
        })
      },
      { workspacePath: ws.path, interval },
    )
    cleanups.push(cleanup)
  }

  stopMutationWatcher = () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
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
function broadcastToWorkspace(workspacePath: string, message: Record<string, unknown>): void {
  const data = JSON.stringify(message)
  for (const client of wsClients) {
    if (client.ws.readyState !== client.ws.OPEN) continue
    // Send to clients subscribed to this workspace, or to all if no subscriptions
    if (client.subscribedWorkspaces.size === 0 || client.subscribedWorkspaces.has(workspacePath)) {
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
        timestamp: Date.now(),
      }),
    )

    ws.on("message", (raw: RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as {
          type: string
          workspaceId?: string
          workspace?: string
        }

        switch (message.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
            break

          case "ws:subscribe_workspace":
            {
              const wsPath = message.workspace ?? message.workspaceId
              if (wsPath) {
                client.subscribedWorkspaces.add(wsPath)
                ws.send(
                  JSON.stringify({
                    type: "ws:subscribed",
                    workspace: wsPath,
                    timestamp: Date.now(),
                  }),
                )
              }
            }
            break

          default:
            // Unknown message type -- ignore
            break
        }
      } catch {
        // Invalid JSON -- ignore
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
    enableMutationPolling: process.env.BEADS_DISABLE_POLLING !== "true",
    mutationPollingInterval: parseInt(process.env.BEADS_POLL_INTERVAL || "1000", 10),
  }
}

// Express app

/** Create an Express application with all beads API endpoints configured. */
function createApp(_config: BeadsServerConfig): Express {
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

  // Workspace info (requires workspace query param — accepts path or owner/repo ID)
  app.get("/api/workspace", async (req: Request, res: Response) => {
    try {
      const workspaceParam = (req.query.workspace as string)?.trim()
      if (!workspaceParam) {
        res.status(400).json({ ok: false, error: "workspace query parameter is required" })
        return
      }

      const workspacePath = resolveWorkspacePath(workspaceParam)
      if (!workspacePath) {
        res.status(404).json({ ok: false, error: `workspace not found: ${workspaceParam}` })
        return
      }

      const proxy = getBeadsClient(workspacePath)
      const info = (await proxy.getInfo()) as {
        daemon_connected: boolean
        daemon_status?: string
        config?: Record<string, string>
      }

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

  // List workspaces (no workspace param needed)
  app.get("/api/workspaces", async (_req: Request, res: Response) => {
    try {
      const workspaces = discoverWorkspaces()

      // Add accent colors and active issue counts for each workspace
      const workspacesWithMetadata = await Promise.all(
        workspaces.map(async ws => {
          const accentColor = await readPeacockColor(ws.path)

          let activeIssueCount: number | undefined
          try {
            const wsProxy = getBeadsClient(ws.path)
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
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list workspaces"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Theme discovery
  app.get("/api/themes", async (_req, res) => {
    const discovery = new ThemeDiscovery()
    const initialized = await discovery.initialize()
    if (!initialized) {
      res.json({ themes: [], variant: null })
      return
    }
    const themes = await discovery.discoverThemes()
    res.json({
      themes,
      variant: discovery.getVariantName(),
    })
  })

  // Theme detail endpoint
  app.get("/api/themes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string }
      const decodedId = decodeURIComponent(id)

      const discovery = new ThemeDiscovery()
      const initialized = await discovery.initialize()
      if (!initialized) {
        res.status(404).json({ ok: false, error: "No VS Code installation found" })
        return
      }

      const themeMeta = await discovery.findThemeById(decodedId)
      if (!themeMeta) {
        res.status(404).json({ ok: false, error: "Theme not found" })
        return
      }

      const themeData = await discovery.readThemeFile(themeMeta.path)
      if (!themeData) {
        res.status(500).json({ ok: false, error: "Failed to read theme file" })
        return
      }

      // Inject the type from package.json metadata (VS Code theme files don't include type)
      const themeDataWithType = { ...(themeData as object), type: themeMeta.type }

      const parseResult = parseThemeObject(themeDataWithType)
      if (!parseResult.success) {
        res.status(500).json({ ok: false, error: `Failed to parse theme: ${parseResult.error}` })
        return
      }

      const cssVariables = mapThemeToCSSVariables(parseResult.theme)
      const appTheme = createAppTheme(parseResult.theme, themeMeta)

      res.status(200).json({
        ok: true,
        theme: appTheme,
        cssVariables,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get theme"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // ── Task management (delegated to @herbcaudill/beads-view) ────────
  registerTaskRoutes({ app, getBeadsClient })

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
  // Start mutation polling if enabled
  if (config.enableMutationPolling !== false) {
    startMutationPolling(config.mutationPollingInterval)
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
