import express, { type Express, type Request, type Response } from "express"
import { createServer, type Server } from "node:http"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { WebSocketServer, type WebSocket, type RawData } from "ws"
import { RalphManager, type RalphEvent, type RalphStatus } from "./RalphManager.js"
import { BdProxy, type BdCreateOptions } from "./BdProxy.js"
import { getAliveWorkspaces } from "./registry.js"
import { getEventLogStore, type EventLogMetadata } from "./EventLogStore.js"
import { TaskChatManager, type TaskChatMessage, type TaskChatStatus } from "./TaskChatManager.js"
import { getThemeDiscovery } from "./ThemeDiscovery.js"
import { parseThemeObject } from "../src/lib/theme/parser.js"
import { mapThemeToCSSVariables, createAppTheme } from "../src/lib/theme/mapper.js"

const execFileAsync = promisify(execFile)

// Git Branch Reader

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
    // Not a git repo or git not installed - return null
    return null
  }
}

// Peacock Color Reader

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
    // File doesn't exist or is invalid JSON - return null (fallback to black)
    return null
  }
}

// Configuration

export interface ServerConfig {
  host: string
  port: number
  appDir: string
}

function getConfig(): ServerConfig {
  return {
    host: process.env.HOST || "localhost",
    port: parseInt(process.env.PORT || "3000", 10),
    appDir: path.resolve(import.meta.dirname, "..", "dist"),
  }
}

// Express App

function createApp(config: ServerConfig): Express {
  const app = express()

  // Disable x-powered-by header
  app.disable("x-powered-by")

  // Parse JSON bodies
  app.use(express.json())

  // Health endpoint
  app.get("/healthz", (_req: Request, res: Response) => {
    res.type("application/json")
    res.status(200).json({ ok: true })
  })

  // API endpoints
  app.post("/api/start", async (req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      if (manager.isRunning) {
        res.status(409).json({ ok: false, error: "Ralph is already running" })
        return
      }

      const { iterations } = req.body as { iterations?: number }
      await manager.start(iterations)
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/stop", async (_req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      if (!manager.isRunning && manager.status !== "paused") {
        res.status(409).json({ ok: false, error: "Ralph is not running" })
        return
      }

      await manager.stop()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/pause", (_req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      manager.pause()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/resume", (_req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      manager.resume()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/stop-after-current", (_req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      manager.stopAfterCurrent()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop after current"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/cancel-stop-after-current", async (_req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      await manager.cancelStopAfterCurrent()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel stop after current"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/message", (req: Request, res: Response) => {
    try {
      const manager = getRalphManager()
      if (!manager.isRunning) {
        res.status(409).json({ ok: false, error: "Ralph is not running" })
        return
      }

      const { message } = req.body as { message?: string | object }
      if (message === undefined) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      // Wrap string messages in JSON format that Ralph CLI expects
      const payload =
        typeof message === "string" ? { type: "user_message", content: message } : message
      manager.send(payload)
      res.status(200).json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  // Status endpoint (GET for convenience)
  app.get("/api/status", (_req: Request, res: Response) => {
    const manager = getRalphManager()
    res.status(200).json({ ok: true, status: manager.status })
  })

  // Workspace info endpoint
  app.get("/api/workspace", async (_req: Request, res: Response) => {
    try {
      const bdProxy = getBdProxy()
      const info = await bdProxy.getInfo()

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
          bdProxy.list({ status: "open", limit: 0 }),
          bdProxy.list({ status: "in_progress", limit: 0 }),
        ])
        activeIssueCount = openIssues.length + inProgressIssues.length
      } catch {
        // If we can't get issue count, leave it undefined
      }

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
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get workspace info"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // List all available workspaces from the global registry
  app.get("/api/workspaces", async (_req: Request, res: Response) => {
    try {
      // Get current workspace path for marking active
      const bdProxy = getBdProxy()
      let currentWorkspacePath: string | undefined
      try {
        const info = await bdProxy.getInfo()
        currentWorkspacePath = info.database_path.replace(/\/.beads\/beads\.db$/, "")
      } catch {
        // If we can't get current workspace, that's fine - just don't mark any as active
      }

      const workspaces = getAliveWorkspaces(currentWorkspacePath)

      // Add accent colors and active issue counts for each workspace
      const workspacesWithMetadata = await Promise.all(
        workspaces.map(async ws => {
          const accentColor = await readPeacockColor(ws.path)

          // Get count of open + in_progress issues for this workspace
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
        currentPath: currentWorkspacePath,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list workspaces"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Switch to a different workspace
  app.post("/api/workspace/switch", async (req: Request, res: Response) => {
    try {
      const { path: workspacePath } = req.body as { path?: string }

      if (!workspacePath?.trim()) {
        res.status(400).json({ ok: false, error: "Workspace path is required" })
        return
      }

      // Switch the BdProxy to the new workspace and start Ralph in watch mode
      await switchWorkspace(workspacePath)

      // Get info from the new workspace to confirm it works
      const bdProxy = getBdProxy()
      const info = await bdProxy.getInfo()

      // Read peacock accent color and git branch in parallel
      const [accentColor, branch] = await Promise.all([
        readPeacockColor(workspacePath),
        getGitBranch(workspacePath),
      ])

      // Get count of open + in_progress issues (active issues)
      let activeIssueCount: number | undefined
      try {
        const [openIssues, inProgressIssues] = await Promise.all([
          bdProxy.list({ status: "open", limit: 0 }),
          bdProxy.list({ status: "in_progress", limit: 0 }),
        ])
        activeIssueCount = openIssues.length + inProgressIssues.length
      } catch {
        // If we can't get issue count, leave it undefined
      }

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
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch workspace"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Task management endpoints
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const { status, ready, all } = req.query as {
        status?: string
        ready?: string
        all?: string
      }

      const bdProxy = getBdProxy()
      const issues = await bdProxy.list({
        status: status as "open" | "in_progress" | "blocked" | "deferred" | "closed" | undefined,
        ready: ready === "true",
        all: all === "true",
        limit: 0, // Fetch all tasks, no limit
      })

      res.status(200).json({ ok: true, issues })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list tasks"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const { title, description, priority, type, assignee, parent, labels } = req.body as {
        title?: string
        description?: string
        priority?: number
        type?: string
        assignee?: string
        parent?: string
        labels?: string[]
      }

      if (!title?.trim()) {
        res.status(400).json({ ok: false, error: "Title is required" })
        return
      }

      const bdProxy = getBdProxy()
      const options: BdCreateOptions = { title: title.trim() }
      if (description) options.description = description
      if (priority !== undefined) options.priority = priority
      if (type) options.type = type
      if (assignee) options.assignee = assignee
      if (parent) options.parent = parent
      if (labels) options.labels = labels

      const issue = await bdProxy.create(options)
      res.status(201).json({ ok: true, issue })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get a single task by ID
  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params

      const bdProxy = getBdProxy()
      const issues = await bdProxy.show(id)

      if (issues.length === 0) {
        res.status(404).json({ ok: false, error: "Task not found" })
        return
      }

      res.status(200).json({ ok: true, issue: issues[0] })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Update a task
  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { title, description, priority, status, type, assignee, parent } = req.body as {
        title?: string
        description?: string
        priority?: number
        status?: "open" | "in_progress" | "blocked" | "deferred" | "closed"
        type?: string
        assignee?: string
        parent?: string
      }

      const bdProxy = getBdProxy()
      const issues = await bdProxy.update(id, {
        title,
        description,
        priority,
        status,
        type,
        assignee,
        parent,
      })

      if (issues.length === 0) {
        res.status(404).json({ ok: false, error: "Task not found" })
        return
      }

      res.status(200).json({ ok: true, issue: issues[0] })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete a task
  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params

      const bdProxy = getBdProxy()
      await bdProxy.delete(id)

      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get labels for a task
  app.get("/api/tasks/:id/labels", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string

      const bdProxy = getBdProxy()
      const labels = await bdProxy.getLabels(id)

      res.status(200).json({ ok: true, labels })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get labels"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Add a label to a task
  app.post("/api/tasks/:id/labels", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const { label } = req.body as { label?: string }

      if (!label?.trim()) {
        res.status(400).json({ ok: false, error: "Label is required" })
        return
      }

      const bdProxy = getBdProxy()
      const result = await bdProxy.addLabel(id, label.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add label"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Remove a label from a task
  app.delete("/api/tasks/:id/labels/:label", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const label = req.params.label as string

      if (!label?.trim()) {
        res.status(400).json({ ok: false, error: "Label is required" })
        return
      }

      const bdProxy = getBdProxy()
      const result = await bdProxy.removeLabel(id, label.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove label"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // List all unique labels in the database
  app.get("/api/labels", async (_req: Request, res: Response) => {
    try {
      const bdProxy = getBdProxy()
      const labels = await bdProxy.listAllLabels()

      res.status(200).json({ ok: true, labels })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list labels"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get comments for a task
  app.get("/api/tasks/:id/comments", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string

      const bdProxy = getBdProxy()
      const comments = await bdProxy.getComments(id)

      res.status(200).json({ ok: true, comments })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get comments"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Add a comment to a task
  app.post("/api/tasks/:id/comments", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const { comment, author } = req.body as { comment?: string; author?: string }

      if (!comment?.trim()) {
        res.status(400).json({ ok: false, error: "Comment is required" })
        return
      }

      const bdProxy = getBdProxy()
      await bdProxy.addComment(id, comment.trim(), author)

      res.status(201).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add comment"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Event log endpoints
  app.post("/api/eventlogs", async (req: Request, res: Response) => {
    try {
      const { events, metadata } = req.body as {
        events?: RalphEvent[]
        metadata?: EventLogMetadata
      }

      if (!events || !Array.isArray(events)) {
        res.status(400).json({ ok: false, error: "Events array is required" })
        return
      }

      const eventLogStore = getEventLogStore()
      const eventLog = await eventLogStore.create(events, metadata)

      res.status(201).json({ ok: true, eventlog: eventLog })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create event log"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.get("/api/eventlogs/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string

      const eventLogStore = getEventLogStore()
      const eventLog = await eventLogStore.get(id)

      if (!eventLog) {
        res.status(404).json({ ok: false, error: "Event log not found" })
        return
      }

      res.status(200).json({ ok: true, eventlog: eventLog })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get event log"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.get("/api/eventlogs", async (_req: Request, res: Response) => {
    try {
      const eventLogStore = getEventLogStore()
      const summaries = await eventLogStore.list()

      res.status(200).json({ ok: true, eventlogs: summaries })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list event logs"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Task chat endpoints
  app.post("/api/task-chat/message", (req: Request, res: Response) => {
    try {
      const { message } = req.body as { message?: string }

      if (!message?.trim()) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      const taskChatManager = getTaskChatManager()

      if (taskChatManager.isProcessing) {
        res.status(409).json({ ok: false, error: "A request is already in progress" })
        return
      }

      // Fire and forget - don't await the response
      // The response will come via WebSocket events (task-chat:message, task-chat:chunk, etc.)
      taskChatManager.sendMessage(message.trim()).catch(err => {
        // Errors are already handled via WebSocket events (task-chat:error)
        console.error("[task-chat] Error sending message:", err)
      })

      // Return immediately - the actual response will come via WebSocket
      res.status(202).json({
        ok: true,
        status: "processing",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  app.get("/api/task-chat/messages", (_req: Request, res: Response) => {
    try {
      const taskChatManager = getTaskChatManager()
      res.status(200).json({
        ok: true,
        messages: taskChatManager.messages,
        status: taskChatManager.status,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get messages"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/task-chat/clear", (_req: Request, res: Response) => {
    try {
      const taskChatManager = getTaskChatManager()
      taskChatManager.clearHistory()
      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear history"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/task-chat/cancel", (_req: Request, res: Response) => {
    try {
      const taskChatManager = getTaskChatManager()
      taskChatManager.cancel()
      res.status(200).json({ ok: true, status: taskChatManager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel request"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.get("/api/task-chat/status", (_req: Request, res: Response) => {
    try {
      const taskChatManager = getTaskChatManager()
      res.status(200).json({
        ok: true,
        status: taskChatManager.status,
        messageCount: taskChatManager.messages.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get status"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Theme API endpoints
  app.get("/api/themes", async (_req: Request, res: Response) => {
    try {
      const themeDiscovery = await getThemeDiscovery()
      const themes = await themeDiscovery.discoverThemes()
      const currentTheme = await themeDiscovery.getCurrentTheme()

      res.status(200).json({
        ok: true,
        themes,
        currentTheme,
        variant: themeDiscovery.getVariantName(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list themes"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.get("/api/themes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string }
      const decodedId = decodeURIComponent(id)

      const themeDiscovery = await getThemeDiscovery()
      const themeMeta = await themeDiscovery.findThemeById(decodedId)

      if (!themeMeta) {
        res.status(404).json({ ok: false, error: "Theme not found" })
        return
      }

      // Read and parse the theme file
      const themeData = await themeDiscovery.readThemeFile(themeMeta.path)
      if (!themeData) {
        res.status(500).json({ ok: false, error: "Failed to read theme file" })
        return
      }

      const parseResult = parseThemeObject(themeData)
      if (!parseResult.success) {
        res.status(500).json({ ok: false, error: `Failed to parse theme: ${parseResult.error}` })
        return
      }

      // Map to CSS variables and create app theme
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

  // Static assets from dist (built by Vite)
  app.use(express.static(config.appDir))

  // SPA fallback - serve index.html for non-API routes
  // Express 5 requires named parameter for wildcard routes
  app.get("/{*splat}", (req: Request, res: Response) => {
    // Never serve HTML for API routes - return 404 JSON instead
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, error: "Not found" })
      return
    }

    const indexPath = path.join(config.appDir, "index.html")
    res.sendFile(indexPath, err => {
      if (err) {
        res.status(404).send("Not found")
      }
    })
  })

  return app
}

// WebSocket Server

export interface WsClient {
  ws: WebSocket
  isAlive: boolean
}

const clients = new Set<WsClient>()

/**
 * Get the number of connected WebSocket clients.
 */
export function getClientCount(): number {
  return clients.size
}

function attachWsServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" })

  // Heartbeat interval (30s)
  const heartbeatInterval = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        console.log("[ws] client timeout, terminating")
        client.ws.terminate()
        clients.delete(client)
        continue
      }
      client.isAlive = false
      client.ws.ping()
    }
  }, 30_000)

  wss.on("close", () => {
    clearInterval(heartbeatInterval)
  })

  wss.on("connection", (ws: WebSocket) => {
    console.log("[ws] client connected")

    const client: WsClient = { ws, isAlive: true }
    clients.add(client)

    ws.on("pong", () => {
      client.isAlive = true
    })

    ws.on("message", (data: RawData) => {
      handleWsMessage(ws, data)
    })

    ws.on("close", () => {
      console.log("[ws] client disconnected")
      clients.delete(client)
    })

    ws.on("error", err => {
      console.error("[ws] client error:", err)
      clients.delete(client)
    })

    // Send welcome message with current Ralph status
    const manager = getRalphManager()
    ws.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        ralphStatus: manager.status,
      }),
    )
  })

  return wss
}

function handleWsMessage(ws: WebSocket, data: RawData): void {
  try {
    const message = JSON.parse(data.toString())
    console.log("[ws] received:", message.type)

    // Handle different message types
    switch (message.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
        break

      case "chat_message": {
        // Forward user message to ralph stdin
        const manager = getRalphManager()
        const chatMessage = message.message as string | undefined
        if (!chatMessage) {
          ws.send(
            JSON.stringify({ type: "error", error: "Message is required", timestamp: Date.now() }),
          )
          return
        }

        if (!manager.isRunning) {
          ws.send(
            JSON.stringify({ type: "error", error: "Ralph is not running", timestamp: Date.now() }),
          )
          return
        }

        // Send to ralph - wrap in JSON format that Ralph CLI expects
        manager.send({ type: "user_message", content: chatMessage })

        // Broadcast user message to all clients so it appears in event stream
        broadcast({
          type: "user_message",
          message: chatMessage,
          timestamp: Date.now(),
        })
        break
      }

      default:
        console.log("[ws] unknown message type:", message.type)
    }
  } catch (err) {
    console.error("[ws] failed to parse message:", err)
  }
}

/**
 * Broadcast a message to all connected clients.
 */
export function broadcast(message: unknown): void {
  const payload = JSON.stringify(message)
  for (const client of clients) {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(payload)
    }
  }
}

// BdProxy Integration

// Singleton BdProxy instance
let bdProxy: BdProxy | null = null

/**
 * Get the singleton BdProxy instance, creating it if needed.
 */
export function getBdProxy(): BdProxy {
  if (!bdProxy) {
    bdProxy = new BdProxy()
  }
  return bdProxy
}

/**
 * Reset the BdProxy singleton (for testing).
 */
export function resetBdProxy(): void {
  bdProxy = null
}

/**
 * Switch to a different workspace by creating a new BdProxy with the given cwd.
 * Also stops any running Ralph instance and starts a new one in watch mode for the new workspace.
 */
export async function switchWorkspace(workspacePath: string): Promise<void> {
  // Stop any currently running Ralph instance
  if (ralphManager?.isRunning) {
    await ralphManager.stop()
  }

  // Switch the BdProxy to the new workspace
  bdProxy = new BdProxy({ cwd: workspacePath })

  // Create a new RalphManager for the new workspace with watch mode enabled
  if (ralphManager) {
    ralphManager.removeAllListeners()
  }
  ralphManager = createRalphManager({ cwd: workspacePath, watch: true })

  // Create a new TaskChatManager for the new workspace
  if (taskChatManager) {
    taskChatManager.removeAllListeners()
  }
  taskChatManager = createTaskChatManager({ cwd: workspacePath })

  // Start Ralph in watch mode
  try {
    await ralphManager.start()
  } catch (err) {
    // Log but don't fail - user can manually start later
    console.error("[server] Failed to auto-start Ralph in watch mode:", err)
  }
}

// RalphManager Integration

// Singleton RalphManager instance
let ralphManager: RalphManager | null = null

/**
 * Get the singleton RalphManager instance, creating it if needed.
 */
export function getRalphManager(): RalphManager {
  if (!ralphManager) {
    ralphManager = createRalphManager()
  }
  return ralphManager
}

/**
 * Create a RalphManager and wire up event broadcasting.
 */
function createRalphManager(options?: { cwd?: string; watch?: boolean }): RalphManager {
  const manager = new RalphManager(options)

  // Broadcast ralph events to all WebSocket clients
  manager.on("event", (event: RalphEvent) => {
    broadcast({
      type: "ralph:event",
      event,
      timestamp: Date.now(),
    })
  })

  // Broadcast status changes
  manager.on("status", (status: RalphStatus) => {
    broadcast({
      type: "ralph:status",
      status,
      timestamp: Date.now(),
    })
  })

  // Broadcast non-JSON output lines
  manager.on("output", (line: string) => {
    broadcast({
      type: "ralph:output",
      line,
      timestamp: Date.now(),
    })
  })

  // Broadcast errors
  manager.on("error", (error: Error) => {
    broadcast({
      type: "ralph:error",
      error: error.message,
      timestamp: Date.now(),
    })
  })

  // Broadcast exit events
  manager.on("exit", (info: { code: number | null; signal: string | null }) => {
    broadcast({
      type: "ralph:exit",
      code: info.code,
      signal: info.signal,
      timestamp: Date.now(),
    })
  })

  return manager
}

/**
 * Reset the RalphManager singleton (for testing).
 */
export function resetRalphManager(): void {
  if (ralphManager) {
    ralphManager.removeAllListeners()
    ralphManager = null
  }
}

// TaskChatManager Integration

// Singleton TaskChatManager instance
let taskChatManager: TaskChatManager | null = null

/**
 * Get the singleton TaskChatManager instance, creating it if needed.
 */
export function getTaskChatManager(): TaskChatManager {
  if (!taskChatManager) {
    taskChatManager = createTaskChatManager()
  }
  return taskChatManager
}

/**
 * Create a TaskChatManager and wire up event broadcasting.
 */
function createTaskChatManager(options?: { cwd?: string }): TaskChatManager {
  const manager = new TaskChatManager({
    ...options,
    getBdProxy: () => getBdProxy(),
  })

  // Broadcast task chat messages to all WebSocket clients
  manager.on("message", (message: TaskChatMessage) => {
    broadcast({
      type: "task-chat:message",
      message,
      timestamp: Date.now(),
    })
  })

  // Broadcast streaming chunks
  manager.on("chunk", (text: string) => {
    broadcast({
      type: "task-chat:chunk",
      text,
      timestamp: Date.now(),
    })
  })

  // Broadcast status changes
  manager.on("status", (status: TaskChatStatus) => {
    broadcast({
      type: "task-chat:status",
      status,
      timestamp: Date.now(),
    })
  })

  // Broadcast errors
  manager.on("error", (error: Error) => {
    broadcast({
      type: "task-chat:error",
      error: error.message,
      timestamp: Date.now(),
    })
  })

  return manager
}

/**
 * Reset the TaskChatManager singleton (for testing).
 */
export function resetTaskChatManager(): void {
  if (taskChatManager) {
    taskChatManager.removeAllListeners()
    taskChatManager = null
  }
}

// Port availability check

async function findAvailablePort(
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
    console.log(`[server] port ${port} in use, trying ${port + 1}`)
  }
  throw new Error(
    `No available port found after ${maxAttempts} attempts starting from ${startPort}`,
  )
}

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

// Main entry point

async function startServer(config: ServerConfig): Promise<void> {
  const app = createApp(config)
  const server = createServer(app)

  attachWsServer(server)

  server.on("error", err => {
    console.error("[server] error:", err)
    process.exitCode = 1
  })

  server.listen(config.port, config.host, () => {
    console.log(`[server] ralph-ui running at http://${config.host}:${config.port}`)
    console.log(`[server] WebSocket available at ws://${config.host}:${config.port}/ws`)
  })
}

// Main
;(async () => {
  try {
    const config = getConfig()
    const availablePort = await findAvailablePort(config.host, config.port)
    if (availablePort !== config.port) {
      process.env.PORT = String(availablePort)
      config.port = availablePort
    }
    await startServer(config)
  } catch (err) {
    console.error("[server] startup error:", err)
    process.exitCode = 1
  }
})()
