import express, { type Express, type Request, type Response } from "express"
import { createServer, type Server } from "node:http"
import path from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { WebSocketServer, type WebSocket, type RawData } from "ws"
import { type RalphEvent, type RalphStatus } from "./RalphManager.js"
import { BdProxy, type BdCreateOptions } from "./BdProxy.js"
import { getAliveWorkspaces } from "./getAliveWorkspaces.js"
import {
  type TaskChatEvent,
  type TaskChatMessage,
  type TaskChatStatus,
  type TaskChatToolUse,
} from "./TaskChatManager.js"
import { getThemeDiscovery } from "./lib/getThemeDiscovery.js"
import { parseThemeObject } from "./lib/theme/parser.js"
import { mapThemeToCSSVariables, createAppTheme } from "./lib/theme/mapper.js"
import { WorkspaceContextManager } from "./WorkspaceContextManager.js"
import type { WorkspaceContext } from "./WorkspaceContext.js"
import {
  RalphRegistry,
  type CreateInstanceOptions,
  type RalphInstanceState,
} from "./RalphRegistry.js"
import { getSessionStateStore } from "./SessionStateStore.js"
import { getSessionEventPersister } from "./SessionEventPersister.js"
import type { MutationEvent } from "@herbcaudill/beads"
import type {
  AgentEventEnvelope,
  AgentEventSource,
  AgentEvent,
  AgentPendingEventsResponse,
} from "@herbcaudill/ralph-shared"
import { envelopeToLegacy } from "@herbcaudill/ralph-shared"

const execFileAsync = promisify(execFile)

/**
 * Get the current git branch name for a workspace.
 * Returns null if not a git repo or on any error.
 */
export async function getGitBranch(
  /** The workspace path to check */
  workspacePath: string,
): Promise<string | null> {
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

/**
 * Read the peacock accent color from .vscode/settings.json in the workspace.
 * Returns null if not found or on any error.
 */
export async function readPeacockColor(
  /** The workspace path to check */
  workspacePath: string,
): Promise<string | null> {
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

export interface ServerConfig {
  host: string
  port: number
  appDir: string
  /** Workspace directory for beads database. Defaults to process.cwd() if not set. */
  workspacePath?: string
  /** Log ralph process events to console. Defaults to false. */
  logRalphEvents?: boolean
  /** Command to spawn Ralph CLI (default: "npx", or "tsx" in dev mode) */
  ralphCommand?: string
  /** Arguments for the Ralph CLI command */
  ralphArgs?: string[]
}

/**
 * Detect if we're running in dev mode from within the ralph monorepo.
 * Checks for the monorepo's package.json with name "ralph-monorepo".
 */
function isDevMode(): boolean {
  // Allow explicit override via environment variable
  if (process.env.RALPH_DEV === "true") return true
  if (process.env.RALPH_DEV === "false") return false

  try {
    // Check for monorepo package.json two levels up from server directory
    const monorepoPackageJson = path.resolve(import.meta.dirname, "../../package.json")
    if (!existsSync(monorepoPackageJson)) return false

    const content = JSON.parse(readFileSync(monorepoPackageJson, "utf-8")) as {
      name?: string
    }
    return content.name === "ralph-monorepo"
  } catch {
    return false
  }
}

export function getConfig(): ServerConfig {
  const devMode = isDevMode()

  // In dev mode, use tsx to run the local CLI package directly
  let ralphCommand: string | undefined
  let ralphArgs: string[] | undefined

  if (devMode) {
    const cliEntryPoint = path.resolve(import.meta.dirname, "../../cli/src/index.ts")
    ralphCommand = "tsx"
    ralphArgs = [cliEntryPoint, "--json"]
    console.log("[config] Dev mode detected, using local CLI:", cliEntryPoint)
  }

  return {
    host: process.env.HOST || "localhost",
    port: parseInt(process.env.PORT || "4242", 10),
    appDir: path.resolve(import.meta.dirname, ".."),
    workspacePath: process.env.WORKSPACE_PATH || path.resolve(import.meta.dirname, "../.."),
    logRalphEvents: process.env.LOG_RALPH_EVENTS === "true",
    ralphCommand,
    ralphArgs,
  }
}

/**  Create an Express application with all API endpoints configured. */
function createApp(
  /** Server configuration */
  config: ServerConfig,
): Express {
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

      const { sessions } = req.body as { sessions?: number }
      await manager.start(sessions)
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
      if (!manager.canAcceptMessages) {
        res.status(409).json({ ok: false, error: "Ralph is not running" })
        return
      }

      const { message } = req.body as { message?: string | object }
      if (message === undefined) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      // Wrap string messages in JSON format that Ralph CLI expects
      const payload = typeof message === "string" ? { type: "message", text: message } : message
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

  // Instance-scoped API endpoints (operate on specific Ralph instances by ID)

  // List all instances
  app.get("/api/instances", (_req: Request, res: Response) => {
    const registry = getRalphRegistry()
    const instances = registry.getAll().map(serializeInstanceState)
    res.status(200).json({ ok: true, instances })
  })

  // Export current state to .ralph/state.latest.json (dev mode only)
  app.post("/api/state/export", async (_req: Request, res: Response) => {
    if (!isDevMode()) {
      res.status(403).json({ ok: false, error: "State export is only available in dev mode" })
      return
    }

    try {
      const registry = getRalphRegistry()
      const instances = registry.getAll().map(serializeInstanceState)
      const workspacePath = configuredWorkspacePath || process.cwd()

      const state = {
        exportedAt: new Date().toISOString(),
        instances,
      }

      const ralphDir = path.join(workspacePath, ".ralph")
      await mkdir(ralphDir, { recursive: true })
      await writeFile(
        path.join(ralphDir, "state.latest.json"),
        JSON.stringify(state, null, 2),
        "utf-8",
      )

      res.status(200).json({ ok: true, savedAt: Date.now() })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get a specific instance
  app.get("/api/ralph/:instanceId", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    res.status(200).json({ ok: true, instance: serializeInstanceState(instance) })
  })

  // Get instance status
  app.get("/api/ralph/:instanceId/status", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    res.status(200).json({ ok: true, status: instance.manager.status })
  })

  // Start a specific instance
  app.post("/api/ralph/:instanceId/start", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      if (instance.manager.isRunning) {
        res.status(409).json({ ok: false, error: "Instance is already running" })
        return
      }

      const { sessions } = req.body as { sessions?: number }
      await instance.manager.start(sessions)
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Stop a specific instance
  app.post("/api/ralph/:instanceId/stop", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      if (!instance.manager.isRunning && instance.manager.status !== "paused") {
        res.status(409).json({ ok: false, error: "Instance is not running" })
        return
      }

      await instance.manager.stop()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Pause a specific instance
  app.post("/api/ralph/:instanceId/pause", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      instance.manager.pause()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Resume a specific instance
  app.post("/api/ralph/:instanceId/resume", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      instance.manager.resume()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Stop after current session for a specific instance
  app.post("/api/ralph/:instanceId/stop-after-current", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      instance.manager.stopAfterCurrent()
      res.status(200).json({ ok: true, status: instance.manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop after current"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Cancel stop after current for a specific instance
  app.post(
    "/api/ralph/:instanceId/cancel-stop-after-current",
    async (req: Request, res: Response) => {
      const instanceId = req.params.instanceId as string
      const registry = getRalphRegistry()
      const instance = registry.get(instanceId)

      if (!instance) {
        res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
        return
      }

      try {
        await instance.manager.cancelStopAfterCurrent()
        res.status(200).json({ ok: true, status: instance.manager.status })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to cancel stop after current"
        res.status(500).json({ ok: false, error: message })
      }
    },
  )

  // Send message to a specific instance
  app.post("/api/ralph/:instanceId/message", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()
    const instance = registry.get(instanceId)

    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      if (!instance.manager.canAcceptMessages) {
        res.status(409).json({ ok: false, error: "Instance is not running" })
        return
      }

      const { message } = req.body as { message?: string | object }
      if (message === undefined) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      // Wrap string messages in JSON format that Ralph CLI expects
      const payload = typeof message === "string" ? { type: "message", text: message } : message
      instance.manager.send(payload)
      res.status(200).json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  // Get event history for a specific instance
  app.get("/api/ralph/:instanceId/events", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    const events = registry.getEventHistory(instanceId)
    res.status(200).json({ ok: true, events })
  })

  // Clear event history for a specific instance
  app.delete("/api/ralph/:instanceId/events", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    registry.clearEventHistory(instanceId)
    res.status(200).json({ ok: true })
  })

  // Get current task for a specific instance
  app.get("/api/ralph/:instanceId/current-task", (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    const task = registry.getCurrentTask(instanceId)
    if (task === undefined) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    res.status(200).json({
      ok: true,
      taskId: task.taskId,
      taskTitle: task.taskTitle,
    })
  })

  // Session State Restoration Endpoints

  // Get saved session state for an instance
  app.get("/api/ralph/:instanceId/session-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const state = await registry.loadSessionState(instanceId)

      if (!state) {
        res.status(404).json({ ok: false, error: "No saved session state found" })
        return
      }

      res.status(200).json({ ok: true, state })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load session state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Restore conversation context from saved state
  // This restores the event history and current task tracking from persisted state
  app.post("/api/ralph/:instanceId/restore-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    const instance = registry.get(instanceId)
    if (!instance) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const state = await registry.loadSessionState(instanceId)

      if (!state) {
        res.status(404).json({ ok: false, error: "No saved session state found" })
        return
      }

      // Update the instance's current task from the saved state
      if (state.currentTaskId !== null) {
        // We need to update the instance state directly since there's no public setter
        // This matches how task tracking is normally done via events
        instance.currentTaskId = state.currentTaskId
        instance.currentTaskTitle = state.currentTaskId // Title not stored separately in persisted state
      }

      // Note: The event history is managed per-instance by RalphRegistry and is cleared
      // when a new session starts. For page reload survival, the client should use
      // the saved conversationContext to show the previous state, and the next session
      // will either continue from that context (if Claude SDK supports session resumption)
      // or start fresh with the context available for reference.

      res.status(200).json({
        ok: true,
        restored: {
          instanceId: state.instanceId,
          status: state.status,
          currentTaskId: state.currentTaskId,
          savedAt: state.savedAt,
          messageCount: state.conversationContext.messages.length,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore session state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete saved session state (for "start fresh")
  app.delete("/api/ralph/:instanceId/session-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      const deleted = await registry.deleteSessionState(instanceId)

      if (!deleted) {
        res.status(404).json({ ok: false, error: "No saved session state found" })
        return
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete session state"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Create a new instance
  app.post("/api/instances", async (req: Request, res: Response) => {
    try {
      const { id, name, agentName, worktreePath, workspaceId, branch } = req.body as {
        id?: string
        name?: string
        agentName?: string
        worktreePath?: string | null
        workspaceId?: string | null
        branch?: string | null
      }

      if (!id?.trim()) {
        res.status(400).json({ ok: false, error: "Instance ID is required" })
        return
      }

      if (!name?.trim()) {
        res.status(400).json({ ok: false, error: "Instance name is required" })
        return
      }

      const registry = getRalphRegistry()

      if (registry.has(id)) {
        res.status(409).json({ ok: false, error: `Instance '${id}' already exists` })
        return
      }

      const options: CreateInstanceOptions = {
        id: id.trim(),
        name: name.trim(),
        agentName: agentName?.trim() || name.trim(),
        worktreePath: worktreePath ?? null,
        workspaceId: workspaceId ?? null,
        branch: branch ?? null,
      }

      const instance = registry.create(options)
      res.status(201).json({ ok: true, instance: serializeInstanceState(instance) })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create instance"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete an instance
  app.delete("/api/ralph/:instanceId", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = getRalphRegistry()

    if (!registry.has(instanceId)) {
      res.status(404).json({ ok: false, error: `Instance '${instanceId}' not found` })
      return
    }

    try {
      await registry.dispose(instanceId)
      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete instance"
      res.status(500).json({ ok: false, error: message })
    }
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

      // Extract issue prefix from config
      const issuePrefix = info.config?.issue_prefix ?? null

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

  // Task management endpoints
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const { status, ready, all } = req.query as {
        status?: string
        ready?: string
        all?: string
      }

      const bdProxy = getBdProxy()
      // Use listWithParents to derive parent field from dependency relationships
      const issues = await bdProxy.listWithParents({
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

  // Get blocked tasks (includes both status=blocked and dependency-blocked issues)
  app.get("/api/tasks/blocked", async (req: Request, res: Response) => {
    try {
      const { parent } = req.query as { parent?: string }

      const bdProxy = getBdProxy()
      const issues = await bdProxy.blocked(parent)

      res.status(200).json({ ok: true, issues })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list blocked tasks"
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

      if (!issue) {
        res.status(500).json({ ok: false, error: "Failed to create task - no issue returned" })
        return
      }

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

  // Add a blocker to a task (the blocker blocks this task)
  app.post("/api/tasks/:id/blockers", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const { blockerId } = req.body as { blockerId?: string }

      if (!blockerId?.trim()) {
        res.status(400).json({ ok: false, error: "Blocker ID is required" })
        return
      }

      const bdProxy = getBdProxy()
      const result = await bdProxy.addBlocker(id, blockerId.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add blocker"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Remove a blocker from a task
  app.delete("/api/tasks/:id/blockers/:blockerId", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const blockerId = req.params.blockerId as string

      if (!blockerId?.trim()) {
        res.status(400).json({ ok: false, error: "Blocker ID is required" })
        return
      }

      const bdProxy = getBdProxy()
      const result = await bdProxy.removeBlocker(id, blockerId.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove blocker"
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

  // Task chat endpoints
  app.post("/api/task-chat/message", (req: Request, res: Response) => {
    try {
      const { message } = req.body as {
        message?: string
      }

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
      // Session continuity is managed server-side via SDK session persistence
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
      // Note: Client is authoritative for message history.
      // This endpoint returns an empty array - client should use its local store.
      res.status(200).json({
        ok: true,
        messages: [],
        status: taskChatManager.status,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get messages"
      res.status(500).json({ ok: false, error: message })
    }
  })

  /**
   * Clear task chat history.
   *
   * This triggers a multi-system clear sequence:
   * 1. TaskChatManager.clearHistory() emits "historyCleared" event
   * 2. WorkspaceContext forwards this as "task-chat:cleared" event
   * 3. Server broadcasts "task-chat:cleared" to all connected WebSocket clients
   * 4. Each client receives the broadcast and clears local state
   *
   * This ensures all connected clients stay in sync when history is cleared.
   */
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
      // Note: messageCount removed - client is authoritative for message history
      res.status(200).json({
        ok: true,
        status: taskChatManager.status,
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

      // Inject the type from package.json metadata (VS Code theme files don't include type)
      const themeDataWithType = { ...(themeData as object), type: themeMeta.type }

      const parseResult = parseThemeObject(themeDataWithType)
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

export interface WsClient {
  ws: WebSocket
  isAlive: boolean
  /** Workspace IDs this client is subscribed to. Empty set means "receive all" (backward compat). */
  workspaceIds: Set<string>
}

const clients = new Set<WsClient>()

/**  Get the number of connected WebSocket clients. */
export function getClientCount(): number {
  return clients.size
}

/**
 * Get all connected WebSocket clients.
 * Useful for iterating over clients to send targeted messages.
 */
export function getClients(): ReadonlySet<WsClient> {
  return clients
}

/**  Find a client by its WebSocket connection. */
export function getClientByWebSocket(ws: WebSocket): WsClient | undefined {
  for (const client of clients) {
    if (client.ws === ws) {
      return client
    }
  }
  return undefined
}

/**  Attach a WebSocket server to an HTTP server with heartbeat and message handling. */
function attachWsServer(
  /** The HTTP server to attach to */
  httpServer: Server,
): WebSocketServer {
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

    const client: WsClient = { ws, isAlive: true, workspaceIds: new Set() }
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

    // Send welcome message with current Ralph status and event history
    // Use "default" instanceId to match the frontend store's DEFAULT_INSTANCE_ID
    // This is async because we may need to restore events from disk
    ;(async () => {
      const context = getActiveContext()
      const registry = getRalphRegistry()
      const persister = registry.getSessionEventPersister()

      // Get events: if session is active, try to restore from disk first
      let events = context.eventHistory
      const status = context.ralphManager.status
      const hasActiveSession = status === "running" || status === "paused" || status === "pausing"

      if (hasActiveSession && persister && events.length === 0) {
        // Session is active but no in-memory events - try to restore from disk
        try {
          const RESTORE_TIMEOUT_MS = 5_000
          const persistedEvents = await Promise.race([
            persister.readEvents("default"),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Timed out restoring events from disk")),
                RESTORE_TIMEOUT_MS,
              ),
            ),
          ])
          if (persistedEvents.length > 0) {
            console.log(
              `[ws] Restored ${persistedEvents.length} events from disk for reconnecting client`,
            )
            events = persistedEvents
            // Also populate the in-memory event history so future clients get them
            context.setEventHistory(persistedEvents)
          }
        } catch (err) {
          console.warn("[ws] Failed to restore events from disk:", err)
          // Continue with whatever events we have — don't block the welcome message
        }
      }

      ws.send(
        JSON.stringify({
          type: "connected",
          instanceId: "default",
          timestamp: Date.now(),
          ralphStatus: status,
          events,
        }),
      )

      // Send full instance list so client can hydrate its store
      const allInstances = registry.getAll().map(serializeInstanceState)
      ws.send(
        JSON.stringify({
          type: "instances:list",
          timestamp: Date.now(),
          instances: allInstances,
        }),
      )
    })().catch(err => {
      console.error("[ws] Error sending welcome message:", err)
      // Send a fallback welcome message so the client doesn't stay stuck in 'connecting' state
      try {
        const context = getActiveContext()
        ws.send(
          JSON.stringify({
            type: "connected",
            instanceId: "default",
            timestamp: Date.now(),
            ralphStatus: context.ralphManager.status,
            events: [],
          }),
        )
      } catch (fallbackErr) {
        console.error("[ws] Failed to send fallback welcome message:", fallbackErr)
      }
    })
  })

  return wss
}

/**  Handle incoming WebSocket messages and dispatch to appropriate handlers. */
function handleWsMessage(
  /** The WebSocket connection */
  ws: WebSocket,
  /** The raw message data */
  data: RawData,
): void {
  try {
    const message = JSON.parse(data.toString())
    console.log("[ws] received:", message.type)

    // Handle different message types
    switch (message.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }))
        break

      case "ws:subscribe_workspace": {
        // Client subscribes to receive events for specific workspace(s).
        // Prevents event leakage between workspaces (r-7r110.5).
        const client = getClientByWebSocket(ws)
        if (client) {
          const workspaceIds = message.workspaceIds as string[] | undefined
          if (Array.isArray(workspaceIds)) {
            client.workspaceIds = new Set(workspaceIds)
          } else if (typeof message.workspaceId === "string") {
            client.workspaceIds = new Set([message.workspaceId])
          }
          ws.send(
            JSON.stringify({
              type: "ws:subscribed",
              workspaceIds: [...client.workspaceIds],
              timestamp: Date.now(),
            }),
          )
        }
        break
      }

      case "chat_message": {
        // Forward user message to ralph stdin
        const chatMessage = message.message as string | undefined
        const instanceId = (message.instanceId as string) || "default"
        if (!chatMessage) {
          ws.send(
            JSON.stringify({ type: "error", error: "Message is required", timestamp: Date.now() }),
          )
          return
        }

        // Use RalphRegistry to get the instance (same system as the UI controls)
        const registry = getRalphRegistry()
        const instance = registry.get(instanceId)

        if (!instance) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: `Ralph instance '${instanceId}' not found. Click Start to begin.`,
              timestamp: Date.now(),
            }),
          )
          return
        }

        if (!instance.manager.canAcceptMessages) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Ralph is not running. Click Start to begin.",
              timestamp: Date.now(),
            }),
          )
          return
        }

        // Send to ralph - wrap in JSON format that Ralph CLI expects
        instance.manager.send({ type: "message", text: chatMessage })

        // Broadcast user message to clients in the same workspace so it appears in event stream
        broadcastToWorkspace(instance.workspaceId, {
          type: "user_message",
          message: chatMessage,
          instanceId,
          timestamp: Date.now(),
        })
        break
      }

      case "agent:reconnect": {
        // Unified reconnection handler (r-tufi7.51.4)
        // Replaces the separate "reconnect" and "task-chat:reconnect" message types.
        // The client sends { type: "agent:reconnect", source, instanceId, lastEventTimestamp }
        // and receives { type: "agent:pending_events", source, instanceId, events, ... }.
        const arSource = message.source as AgentEventSource | undefined
        const arInstanceId = (message.instanceId as string) || "default"
        const arLastTs = message.lastEventTimestamp as number | undefined

        if (arSource === "ralph") {
          // --- Ralph: synchronous, in-memory event history ---
          const client = getClientByWebSocket(ws)
          if (!client) {
            ws.send(
              JSON.stringify({
                type: "error",
                error: "Client not found",
                timestamp: Date.now(),
              }),
            )
            break
          }

          const registry = getRalphRegistry()
          const eventHistory = registry.getEventHistory(arInstanceId)

          let pendingEvents: RalphEvent[] = []
          if (typeof arLastTs === "number" && arLastTs > 0) {
            pendingEvents = eventHistory.filter(event => event.timestamp >= arLastTs)
          } else {
            pendingEvents = eventHistory
          }

          const instance = registry.get(arInstanceId)
          const ralphStatus = instance?.manager.status ?? "stopped"

          const response: AgentPendingEventsResponse = {
            type: "agent:pending_events",
            source: "ralph",
            instanceId: arInstanceId,
            events: pendingEvents,
            totalEvents: eventHistory.length,
            status: ralphStatus,
            timestamp: Date.now(),
          }
          ws.send(JSON.stringify(response))

          console.log(
            `[ws] agent:reconnect (ralph) for instance ${arInstanceId}: sent ${pendingEvents.length} pending events (after timestamp ${arLastTs ?? "none"})`,
          )
        } else if (arSource === "task-chat") {
          // --- Task Chat: async, disk-based persister ---
          // Supports non-active instances (critical fix from r-tufi7.51.4)
          ;(async () => {
            try {
              const context = getActiveContext()
              const persister = context.taskChatEventPersister

              let pendingEvents: TaskChatEvent[]
              if (typeof arLastTs === "number" && arLastTs > 0) {
                pendingEvents = await persister.readEventsSince(arInstanceId, arLastTs)
              } else {
                pendingEvents = await persister.readEvents(arInstanceId)
              }

              const totalEvents = await persister.getEventCount(arInstanceId)
              const taskChatStatus = context.taskChatManager.status

              const response: AgentPendingEventsResponse = {
                type: "agent:pending_events",
                source: "task-chat",
                instanceId: arInstanceId,
                events: pendingEvents,
                totalEvents,
                status: taskChatStatus,
                timestamp: Date.now(),
              }
              ws.send(JSON.stringify(response))

              console.log(
                `[ws] agent:reconnect (task-chat) for instance ${arInstanceId}: sent ${pendingEvents.length} pending events (after timestamp ${arLastTs ?? "none"})`,
              )
            } catch (err) {
              console.error("[ws] agent:reconnect (task-chat) failed:", err)
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: `Failed to sync task chat events: ${err instanceof Error ? err.message : "Unknown error"}`,
                  timestamp: Date.now(),
                }),
              )
            }
          })()
        } else {
          console.warn(`[ws] agent:reconnect: unknown source "${arSource}"`)
        }
        break
      }

      // Legacy reconnect handler — kept for backward compatibility (r-tufi7.51.5)
      case "reconnect": {
        // Handle reconnection sync - client sends lastEventTimestamp to get missed events
        const instanceId = (message.instanceId as string) || "default"
        const lastEventTimestamp = message.lastEventTimestamp as number | undefined

        // Get the client for this WebSocket
        const client = getClientByWebSocket(ws)
        if (!client) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Client not found",
              timestamp: Date.now(),
            }),
          )
          return
        }

        // Get event history for the instance
        const registry = getRalphRegistry()
        const eventHistory = registry.getEventHistory(instanceId)

        // Determine which events to send by filtering by timestamp
        let pendingEvents: RalphEvent[] = []

        if (typeof lastEventTimestamp === "number" && lastEventTimestamp > 0) {
          // Client has events up to lastEventTimestamp, send everything at or after (client deduplicates by event ID)
          pendingEvents = eventHistory.filter(event => event.timestamp >= lastEventTimestamp)
        } else {
          // Client has no events, send all
          pendingEvents = eventHistory
        }

        // Get current Ralph status for this instance
        const instance = registry.get(instanceId)
        const status = instance?.manager.status ?? "stopped"

        // Send pending_events response
        ws.send(
          JSON.stringify({
            type: "pending_events",
            instanceId,
            events: pendingEvents,
            totalEvents: eventHistory.length,
            ralphStatus: status,
            timestamp: Date.now(),
          }),
        )

        console.log(
          `[ws] reconnect sync for instance ${instanceId}: sent ${pendingEvents.length} pending events (after timestamp ${lastEventTimestamp ?? "none"})`,
        )
        break
      }

      // Legacy task-chat:reconnect handler — kept for backward compatibility (r-tufi7.51.5)
      case "task-chat:reconnect": {
        // Handle task chat reconnection sync - client sends lastEventTimestamp to get missed events
        const tcInstanceId = (message.instanceId as string) || "default"
        const tcLastEventTimestamp = message.lastEventTimestamp as number | undefined

        // Handle async operations in a self-executing async function
        ;(async () => {
          try {
            // Get the task chat event persister from the active context
            const context = getActiveContext()
            const persister = context.taskChatEventPersister

            // Read events since the client's last known timestamp
            let pendingEvents: TaskChatEvent[]
            if (typeof tcLastEventTimestamp === "number" && tcLastEventTimestamp > 0) {
              pendingEvents = await persister.readEventsSince(tcInstanceId, tcLastEventTimestamp)
            } else {
              // Client has no events, send all
              pendingEvents = await persister.readEvents(tcInstanceId)
            }

            // Get total count for diagnostics
            const totalEvents = await persister.getEventCount(tcInstanceId)

            // Get current task chat status
            const taskChatStatus = context.taskChatManager.status

            // Send pending task chat events response
            ws.send(
              JSON.stringify({
                type: "task-chat:pending_events",
                instanceId: tcInstanceId,
                events: pendingEvents,
                totalEvents,
                status: taskChatStatus,
                timestamp: Date.now(),
              }),
            )

            console.log(
              `[ws] task-chat:reconnect sync for instance ${tcInstanceId}: sent ${pendingEvents.length} pending events (after timestamp ${tcLastEventTimestamp ?? "none"})`,
            )
          } catch (err) {
            console.error("[ws] task-chat:reconnect failed:", err)
            ws.send(
              JSON.stringify({
                type: "task-chat:error",
                error: `Failed to sync task chat events: ${err instanceof Error ? err.message : "Unknown error"}`,
                timestamp: Date.now(),
              }),
            )
          }
        })()
        break
      }

      default:
        console.log("[ws] unknown message type:", message.type)
    }
  } catch (err) {
    console.error("[ws] failed to parse message:", err)
  }
}

/**  Broadcast a message to all connected clients. */
export function broadcast(message: unknown): void {
  const payload = JSON.stringify(message)
  for (const client of clients) {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(payload)
    }
  }
}

/**
 * Broadcast a message only to clients subscribed to a specific workspace.
 * Clients with no workspace subscriptions (empty set) receive all messages
 * for backward compatibility with clients that haven't sent ws:subscribe_workspace.
 *
 * If workspaceId is null, falls back to broadcast() (sent to all clients).
 */
export function broadcastToWorkspace(workspaceId: string | null, message: unknown): void {
  if (workspaceId === null) {
    broadcast(message)
    return
  }
  const payload = JSON.stringify(message)
  for (const client of clients) {
    if (client.ws.readyState !== client.ws.OPEN) continue
    // Send to clients that either:
    // 1. Have no workspace subscriptions (backward compat — receive everything)
    // 2. Are subscribed to this specific workspace
    if (client.workspaceIds.size === 0 || client.workspaceIds.has(workspaceId)) {
      client.ws.send(payload)
    }
  }
}

/**
 * Broadcast an agent event wrapped in the unified AgentEventEnvelope.
 *
 * Both Ralph session events and Task Chat events are wrapped in the same
 * envelope type (`"agent:event"`) with a `source` discriminator, replacing
 * the previous divergent `"ralph:event"` / `"task-chat:event"` wire types.
 */
/**
 * Handle common operational event types shared by both RalphRegistry and
 * WorkspaceContextManager paths. Returns true if the event was handled.
 */
function broadcastOperationalEvent(
  eventType: string,
  instanceId: string,
  workspaceId: string | null,
  args: unknown[],
): boolean {
  switch (eventType) {
    case "ralph:status": {
      const status = args[0] as RalphStatus
      broadcastToWorkspace(workspaceId, {
        type: "ralph:status",
        instanceId,
        workspaceId,
        status,
        timestamp: Date.now(),
      })
      return true
    }
    case "ralph:output": {
      const line = args[0] as string
      broadcastToWorkspace(workspaceId, {
        type: "ralph:output",
        instanceId,
        workspaceId,
        line,
        timestamp: Date.now(),
      })
      return true
    }
    case "ralph:error": {
      const error = args[0] as Error
      broadcastToWorkspace(workspaceId, {
        type: "ralph:error",
        instanceId,
        workspaceId,
        error: error.message,
        timestamp: Date.now(),
      })
      return true
    }
    case "ralph:exit": {
      const info = args[0] as { code: number | null; signal: string | null }
      broadcastToWorkspace(workspaceId, {
        type: "ralph:exit",
        instanceId,
        workspaceId,
        code: info.code,
        signal: info.signal,
        timestamp: Date.now(),
      })
      return true
    }
    default:
      return false
  }
}

/**  Singleton RalphRegistry instance */
let ralphRegistry: RalphRegistry | null = null

/**  Get the singleton RalphRegistry instance, creating it if needed. */
export function getRalphRegistry(): RalphRegistry {
  if (!ralphRegistry) {
    ralphRegistry = new RalphRegistry({
      maxInstances: 10,
    })

    // Wire up event forwarding from the registry to WebSocket clients
    wireRegistryEvents(ralphRegistry)
  }
  return ralphRegistry
}

/**  Wire up event forwarding from RalphRegistry to WebSocket clients. */
function wireRegistryEvents(
  /** The registry to wire up */
  registry: RalphRegistry,
): void {
  registry.on("instance:event", (instanceId: string, eventType: string, ...args: unknown[]) => {
    switch (eventType) {
      case "ralph:event": {
        const event = args[0] as RalphEvent
        const eventHistory = registry.getEventHistory(instanceId)
        // Event index is the position in the event history array (0-based)
        // After adding an event, it's at index length - 1
        const eventIndex = eventHistory.length - 1

        // Get workspaceId from registry instance state
        const instance = registry.get(instanceId)
        const workspaceId = instance?.workspaceId ?? null

        // Broadcast unified agent:event envelope (new path)
        const envelope: AgentEventEnvelope = {
          type: "agent:event",
          source: "ralph",
          instanceId,
          workspaceId,
          event: event as unknown as AgentEvent,
          timestamp: Date.now(),
          eventIndex,
        }
        broadcastToWorkspace(workspaceId, envelope)

        // Also broadcast legacy ralph:event for backward compatibility
        // @deprecated(r-tufi7.51.5): Remove once all clients migrate to agent:event
        const legacy = envelopeToLegacy(envelope)
        if (legacy) broadcastToWorkspace(workspaceId, legacy)
        break
      }
      default: {
        // Handle shared operational events (ralph:status, ralph:output, ralph:error, ralph:exit)
        const opInstance = registry.get(instanceId)
        const opWorkspaceId = opInstance?.workspaceId ?? null
        broadcastOperationalEvent(eventType, instanceId, opWorkspaceId, args)
        break
      }
    }
  })

  registry.on("instance:created", (instanceId: string, state: RalphInstanceState) => {
    broadcastToWorkspace(state.workspaceId, {
      type: "instance:created",
      instanceId,
      workspaceId: state.workspaceId,
      instance: serializeInstanceState(state),
      timestamp: Date.now(),
    })
  })

  registry.on("instance:disposed", (instanceId: string) => {
    // Note: instance may already be disposed, so we can't look up workspaceId.
    // Broadcast to all clients since we don't know which workspace this belonged to.
    broadcast({
      type: "instance:disposed",
      instanceId,
      timestamp: Date.now(),
    })
  })

  registry.on(
    "instance:merge_conflict",
    (
      instanceId: string,
      conflict: { files: string[]; sourceBranch: string; timestamp: number } | null,
    ) => {
      const conflictInstance = registry.get(instanceId)
      const conflictWorkspaceId = conflictInstance?.workspaceId ?? null
      broadcastToWorkspace(conflictWorkspaceId, {
        type: "instance:merge_conflict",
        instanceId,
        workspaceId: conflictWorkspaceId,
        conflict,
        timestamp: Date.now(),
      })
    },
  )
}

/**
 * Serialize a RalphInstanceState for API responses.
 * Excludes the RalphManager reference since it can't be serialized.
 */
function serializeInstanceState(
  /** The instance state to serialize */
  state: RalphInstanceState,
): Omit<RalphInstanceState, "manager"> & { status: RalphStatus } {
  return {
    id: state.id,
    name: state.name,
    agentName: state.agentName,
    worktreePath: state.worktreePath,
    workspaceId: state.workspaceId,
    branch: state.branch,
    createdAt: state.createdAt,
    currentTaskId: state.currentTaskId,
    currentTaskTitle: state.currentTaskTitle,
    status: state.manager.status,
    mergeConflict: state.mergeConflict,
  }
}

/**  Reset the RalphRegistry (for testing). */
export async function resetRalphRegistry(): Promise<void> {
  if (ralphRegistry) {
    await ralphRegistry.disposeAll()
    ralphRegistry = null
  }
}

/**  Singleton WorkspaceContextManager instance */
let workspaceContextManager: WorkspaceContextManager | null = null

/**  Configured workspace path (set by startServer) */
let configuredWorkspacePath: string | undefined

/**  Whether to log ralph events to console (set by startServer) */
let configuredLogRalphEvents: boolean = false

/**  Configured Ralph CLI command (set by startServer) */
let configuredRalphCommand: string | undefined

/**  Configured Ralph CLI arguments (set by startServer) */
let configuredRalphArgs: string[] | undefined

/**  Get the singleton WorkspaceContextManager instance, creating it if needed. */
export function getWorkspaceContextManager(): WorkspaceContextManager {
  if (!workspaceContextManager) {
    workspaceContextManager = new WorkspaceContextManager({
      watch: true,
      env: process.env as Record<string, string>,
      logRalphEvents: configuredLogRalphEvents,
      ralphCommand: configuredRalphCommand,
      ralphArgs: configuredRalphArgs,
    })

    // Wire up event forwarding from the context manager to WebSocket clients
    wireContextManagerEvents(workspaceContextManager)
  }
  return workspaceContextManager
}

/**  Wire up event forwarding from WorkspaceContextManager to WebSocket clients. */
function wireContextManagerEvents(
  /** The manager to wire up */
  manager: WorkspaceContextManager,
): void {
  manager.on("context:event", (workspacePath: string, eventType: string, ...args: unknown[]) => {
    // Only forward events from the active context
    if (workspacePath !== manager.activeWorkspacePath) {
      return
    }

    // Use "default" instanceId for the legacy WorkspaceContextManager path
    // This matches the DEFAULT_INSTANCE_ID in the frontend store
    const instanceId = "default"
    // Legacy path uses the main workspace, so workspaceId is null
    const workspaceId = null

    switch (eventType) {
      case "ralph:event": {
        const event = args[0] as RalphEvent
        // Broadcast unified agent:event envelope (new path)
        const ralphEnvelope: AgentEventEnvelope = {
          type: "agent:event",
          source: "ralph",
          instanceId,
          workspaceId,
          event: event as unknown as AgentEvent,
          timestamp: Date.now(),
        }
        broadcastToWorkspace(workspaceId, ralphEnvelope)
        // Also broadcast legacy ralph:event for backward compatibility
        // @deprecated(r-tufi7.51.5): Remove once all clients migrate to agent:event
        const ralphLegacy = envelopeToLegacy(ralphEnvelope)
        if (ralphLegacy) broadcastToWorkspace(workspaceId, ralphLegacy)
        break
      }
      case "ralph:status":
      case "ralph:output":
      case "ralph:error":
      case "ralph:exit": {
        broadcastOperationalEvent(eventType, instanceId, workspaceId, args)
        break
      }
      // @deprecated(r-tufi7.51.5): Legacy task-chat:* broadcast handlers.
      // These are kept for backward compatibility with older clients that
      // haven't migrated to the unified agent:event envelope. Content from
      // these messages is now also available through task-chat:event / agent:event.
      // Remove these cases once all clients have migrated.
      case "task-chat:message": {
        const message = args[0] as TaskChatMessage
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:message",
          instanceId,
          workspaceId,
          message,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:chunk": {
        const text = args[0] as string
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:chunk",
          instanceId,
          workspaceId,
          text,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:status": {
        const status = args[0] as TaskChatStatus
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:status",
          instanceId,
          workspaceId,
          status,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:error": {
        const error = args[0] as Error
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:error",
          instanceId,
          workspaceId,
          error: error.message,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:tool_use": {
        const toolUse = args[0] as TaskChatToolUse
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:tool_use",
          instanceId,
          workspaceId,
          toolUse,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:tool_update": {
        const toolUse = args[0] as TaskChatToolUse
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:tool_update",
          instanceId,
          workspaceId,
          toolUse,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:tool_result": {
        const toolUse = args[0] as TaskChatToolUse
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:tool_result",
          instanceId,
          workspaceId,
          toolUse,
          timestamp: Date.now(),
        })
        break
      }
      case "task-chat:event": {
        const event = args[0] as TaskChatEvent
        // Broadcast unified agent:event envelope (new path)
        const tcEnvelope: AgentEventEnvelope = {
          type: "agent:event",
          source: "task-chat",
          instanceId,
          workspaceId,
          event: event as unknown as AgentEvent,
          timestamp: Date.now(),
        }
        broadcastToWorkspace(workspaceId, tcEnvelope)
        // Legacy task-chat:event broadcast removed (r-z9gpz) — was causing double-delivery
        // of every event since clients now process agent:event with source="task-chat"
        break
      }
      case "task-chat:cleared": {
        // Task chat history was cleared - broadcast for cross-client sync
        broadcastToWorkspace(workspaceId, {
          type: "task-chat:cleared",
          instanceId,
          workspaceId,
          timestamp: Date.now(),
        })
        break
      }
      case "mutation:event": {
        // Mutation events from beads daemon (task list changes)
        const mutationEvent = args[0] as MutationEvent
        broadcastToWorkspace(workspaceId, {
          type: "mutation:event",
          instanceId,
          workspaceId,
          event: mutationEvent,
          timestamp: Date.now(),
        })
        break
      }
    }
  })
}

/**
 * Get the active WorkspaceContext, creating one if needed.
 * Throws an error if no workspace is configured.
 */
export function getActiveContext(): WorkspaceContext {
  const manager = getWorkspaceContextManager()
  let context = manager.getActiveContext()

  if (!context) {
    // If no active context, create one for the configured workspace path
    const workspacePath = configuredWorkspacePath || process.cwd()
    context = manager.setActiveContext(workspacePath)
  }

  return context
}

/**  Reset the WorkspaceContextManager (for testing). */
export async function resetWorkspaceContextManager(): Promise<void> {
  if (workspaceContextManager) {
    await workspaceContextManager.disposeAll()
    workspaceContextManager = null
  }
}

/**
 * Get the BdProxy for the active workspace.
 * (Legacy accessor - delegates to active context for backwards compatibility)
 */
export function getBdProxy(): BdProxy {
  return getActiveContext().bdProxy
}

/**  Get the RalphManager for the active workspace. */
export function getRalphManager() {
  return getActiveContext().ralphManager
}

/**  Get the TaskChatManager for the active workspace. */
export function getTaskChatManager() {
  return getActiveContext().taskChatManager
}

/**  Get the event history for the active workspace. */
export function getEventHistory(): RalphEvent[] {
  return getActiveContext().eventHistory
}

/**  Clear the event history for the active workspace. */
export function clearEventHistory(): void {
  getActiveContext().clearHistory()
}

/**  Get the current task being worked on in the active workspace. */
export function getCurrentTask(): { taskId?: string; taskTitle?: string } {
  return getActiveContext().currentTask
}

/**
 * Switch to a different workspace.
 * Uses the WorkspaceContextManager to switch contexts, preserving the old context.
 * The old workspace's Ralph process continues running independently.
 */
export async function switchWorkspace(
  /** The path to the new workspace */
  workspacePath: string,
): Promise<void> {
  const manager = getWorkspaceContextManager()

  // Switch to the new context (creates it if it doesn't exist)
  // Note: This does NOT stop Ralph in the old context - it keeps running
  const context = manager.setActiveContext(workspacePath)

  // Update the SessionStateStore, SessionEventPersister, and BdProxy for the new workspace
  const registry = getRalphRegistry()
  const sessionStateStore = getSessionStateStore(workspacePath)
  registry.setSessionStateStore(sessionStateStore)

  // Update the SessionEventPersister to point to the new workspace
  const sessionEventPersister = getSessionEventPersister(workspacePath)
  registry.setSessionEventPersister(sessionEventPersister)

  // Update the BdProxy to point to the new workspace
  const bdProxy = new BdProxy({ cwd: workspacePath })
  registry.setBdProxy(bdProxy)

  // Cleanup stale session states in the new workspace
  try {
    const removed = await sessionStateStore.cleanupStale()
    if (removed > 0) {
      console.log(`[server] Cleaned up ${removed} stale session state(s) in new workspace`)
    }
  } catch (err) {
    console.warn("[server] Failed to cleanup stale session states:", err)
  }

  // Start Ralph in watch mode if not already running
  if (!context.ralphManager.isRunning && context.ralphManager.status !== "paused") {
    try {
      await context.ralphManager.start()
    } catch (err) {
      // Log but don't fail - user can manually start later
      console.error("[server] Failed to auto-start Ralph in watch mode:", err)
    }
  }

  // Broadcast workspace switch to all connected clients
  // This allows the frontend to sync with the new workspace's state
  // Use "default" instanceId to match the frontend store's DEFAULT_INSTANCE_ID
  broadcast({
    type: "workspace_switched",
    instanceId: "default",
    workspacePath,
    ralphStatus: context.ralphManager.status,
    events: context.eventHistory,
    timestamp: Date.now(),
  })
}

// Legacy reset functions for backwards compatibility in tests
export function resetBdProxy(): void {
  // No-op: contexts are managed by WorkspaceContextManager
}

export function resetRalphManager(): void {
  // No-op: contexts are managed by WorkspaceContextManager
}

export function resetTaskChatManager(): void {
  // No-op: contexts are managed by WorkspaceContextManager
}

/**  Find an available port by trying consecutive ports starting from the given port. */
export async function findAvailablePort(
  /** The host to check */
  host: string,
  /** The starting port number */
  startPort: number,
  /** Maximum number of port attempts */
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

/**  Check if a port is available for listening. */
function checkPortAvailable(
  /** The host to check */
  host: string,
  /** The port number to check */
  port: number,
): Promise<boolean> {
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

/**  Default instance constants (must match frontend store/index.ts) */
const DEFAULT_INSTANCE_ID = "default"
const DEFAULT_INSTANCE_NAME = "Main"
const DEFAULT_AGENT_NAME = "Ralph"

/**
 * Gracefully shutdown the server, stopping all Ralph processes.
 * Called on SIGINT (Ctrl+C) and SIGTERM.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[server] Received ${signal}, shutting down gracefully...`)

  // Stop all Ralph instances in the registry
  const registry = ralphRegistry
  if (registry) {
    console.log("[server] Stopping all Ralph instances...")
    try {
      await registry.disposeAll()
      console.log("[server] All Ralph instances stopped")
    } catch (err) {
      console.error("[server] Error stopping Ralph instances:", err)
    }
  }

  // Stop all workspace contexts
  const contextManager = workspaceContextManager
  if (contextManager) {
    console.log("[server] Disposing workspace contexts...")
    try {
      await contextManager.disposeAll()
      console.log("[server] Workspace contexts disposed")
    } catch (err) {
      console.error("[server] Error disposing workspace contexts:", err)
    }
  }

  console.log("[server] Shutdown complete")
  process.exit(0)
}

/**  Start the server with the given configuration. */
export async function startServer(
  /** Server configuration */
  config: ServerConfig,
): Promise<void> {
  // Set the configured options for use by BdProxy, RalphManager, etc.
  configuredWorkspacePath = config.workspacePath
  configuredLogRalphEvents = config.logRalphEvents ?? false
  configuredRalphCommand = config.ralphCommand
  configuredRalphArgs = config.ralphArgs

  if (configuredWorkspacePath) {
    console.log(`[server] Using workspace: ${configuredWorkspacePath}`)
  }

  if (configuredLogRalphEvents) {
    console.log("[server] Ralph event logging enabled")
  }

  if (configuredRalphCommand) {
    console.log(
      `[server] Using Ralph command: ${configuredRalphCommand} ${configuredRalphArgs?.join(" ") ?? ""}`,
    )
  }

  // Cleanup stale session states at startup (files older than 1 hour)
  // and wire the SessionStateStore into the RalphRegistry for state persistence
  const workspacePath = configuredWorkspacePath || process.cwd()
  const sessionStateStore = getSessionStateStore(workspacePath)
  try {
    const removed = await sessionStateStore.cleanupStale()
    if (removed > 0) {
      console.log(`[server] Cleaned up ${removed} stale session state(s)`)
    }
  } catch (err) {
    // Log but don't fail startup - stale state cleanup is not critical
    console.warn("[server] Failed to cleanup stale session states:", err)
  }

  // Create default instance in registry if it doesn't exist
  const registry = getRalphRegistry()

  // Wire the SessionStateStore into the registry for state persistence
  registry.setSessionStateStore(sessionStateStore)

  // Wire the SessionEventPersister into the registry for live event persistence
  const sessionEventPersister = getSessionEventPersister(workspacePath)
  registry.setSessionEventPersister(sessionEventPersister)

  // Wire the BdProxy into the registry for adding session log links to tasks
  const bdProxy = new BdProxy({ cwd: workspacePath })
  registry.setBdProxy(bdProxy)

  if (!registry.has(DEFAULT_INSTANCE_ID)) {
    registry.create({
      id: DEFAULT_INSTANCE_ID,
      name: DEFAULT_INSTANCE_NAME,
      agentName: DEFAULT_AGENT_NAME,
      worktreePath: null,
      workspaceId: null, // Main workspace has no workspaceId
      branch: null,
      managerOptions: {
        command: configuredRalphCommand,
        args: configuredRalphArgs,
      },
    })
    console.log(`[server] Created default instance: ${DEFAULT_INSTANCE_ID}`)
  }

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

  // Register signal handlers for graceful shutdown
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
}
