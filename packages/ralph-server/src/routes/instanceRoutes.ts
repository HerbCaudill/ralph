import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import type { Express, Request, Response } from "express"
import type { CreateInstanceOptions } from "../RalphRegistry.js"
import type { AgentRouteContext } from "./types.js"
import { serializeInstanceState } from "./types.js"

/**
 * Register instance-scoped routes on an Express app.
 *
 * Routes:
 * - GET    /api/instances
 * - POST   /api/instances
 * - POST   /api/state/export
 * - GET    /api/ralph/:instanceId
 * - GET    /api/ralph/:instanceId/status
 * - POST   /api/ralph/:instanceId/start
 * - POST   /api/ralph/:instanceId/stop
 * - POST   /api/ralph/:instanceId/pause
 * - POST   /api/ralph/:instanceId/resume
 * - POST   /api/ralph/:instanceId/stop-after-current
 * - POST   /api/ralph/:instanceId/cancel-stop-after-current
 * - POST   /api/ralph/:instanceId/message
 * - GET    /api/ralph/:instanceId/events
 * - DELETE /api/ralph/:instanceId/events
 * - GET    /api/ralph/:instanceId/current-task
 * - GET    /api/ralph/:instanceId/session-state
 * - POST   /api/ralph/:instanceId/restore-state
 * - DELETE /api/ralph/:instanceId/session-state
 * - DELETE /api/ralph/:instanceId
 */
export function registerInstanceRoutes(app: Express, ctx: AgentRouteContext): void {
  // List all instances
  app.get("/api/instances", (_req: Request, res: Response) => {
    const registry = ctx.getRalphRegistry()
    const instances = registry.getAll().map(serializeInstanceState)
    res.status(200).json({ ok: true, instances })
  })

  // Export current state to .ralph/state.latest.json (dev mode only)
  app.post("/api/state/export", async (_req: Request, res: Response) => {
    if (!ctx.isDevMode()) {
      res.status(403).json({ ok: false, error: "State export is only available in dev mode" })
      return
    }

    try {
      const registry = ctx.getRalphRegistry()
      const instances = registry.getAll().map(serializeInstanceState)
      const workspacePath = ctx.getWorkspacePath()

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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
      const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()
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
    const registry = ctx.getRalphRegistry()

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
    const registry = ctx.getRalphRegistry()

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
    const registry = ctx.getRalphRegistry()

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
    const registry = ctx.getRalphRegistry()

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
  app.post("/api/ralph/:instanceId/restore-state", async (req: Request, res: Response) => {
    const instanceId = req.params.instanceId as string
    const registry = ctx.getRalphRegistry()

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

      if (state.currentTaskId !== null) {
        instance.currentTaskId = state.currentTaskId
        instance.currentTaskTitle = state.currentTaskId
      }

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
    const registry = ctx.getRalphRegistry()

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

      const registry = ctx.getRalphRegistry()

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
    const registry = ctx.getRalphRegistry()

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
}
