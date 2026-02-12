import type { Express, Request, Response } from "express"
import type { WorkerOrchestratorManager } from "../lib/WorkerOrchestratorManager.js"

/**
 * Context for orchestrator route handlers.
 */
export interface OrchestratorRouteContext {
  /**
   * Get the WorkerOrchestratorManager instance for a workspace.
   * Returns null if no orchestrator is configured for the given workspace.
   */
  getOrchestrator: (workspaceId?: string) => WorkerOrchestratorManager | null
}

/**
 * Extract a route param as a string.
 */
function param(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

/**
 * Register orchestrator control routes on an Express app.
 *
 * Routes:
 * - GET  /api/orchestrator                     - Get orchestrator state
 * - POST /api/orchestrator/start               - Start the orchestrator
 * - POST /api/orchestrator/stop                - Stop all workers immediately
 * - POST /api/orchestrator/stop-after-current  - Stop after current tasks complete
 * - POST /api/orchestrator/cancel-stop         - Cancel pending stop-after-current
 *
 * - GET  /api/workers                          - List all active workers
 * - GET  /api/workers/:name                    - Get specific worker state
 * - POST /api/workers/:name/pause              - Pause a specific worker
 * - POST /api/workers/:name/resume             - Resume a paused worker
 * - POST /api/workers/:name/stop               - Stop a specific worker
 */
export function registerOrchestratorRoutes(
  /** The Express app. */
  app: Express,
  /** Route handler context. */
  ctx: OrchestratorRouteContext,
): void {
  // ── Orchestrator routes ─────────────────────────────────────────────

  // Get orchestrator state
  app.get("/api/orchestrator", (req: Request, res: Response) => {
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    res.json({
      state: orchestrator.getState(),
      maxWorkers: orchestrator.getMaxWorkers(),
      activeWorkerCount: orchestrator.getActiveWorkerCount(),
    })
  })

  // Start the orchestrator
  app.post("/api/orchestrator/start", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspace as string | undefined
      const orchestrator = ctx.getOrchestrator(workspaceId)

      if (!orchestrator) {
        res.status(404).json({ error: "Orchestrator not configured" })
        return
      }

      await orchestrator.start()
      res.json({
        ok: true,
        state: orchestrator.getState(),
      })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // Stop all workers immediately
  app.post("/api/orchestrator/stop", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspace as string | undefined
      const orchestrator = ctx.getOrchestrator(workspaceId)

      if (!orchestrator) {
        res.status(404).json({ error: "Orchestrator not configured" })
        return
      }

      await orchestrator.stop()
      res.json({
        ok: true,
        state: orchestrator.getState(),
      })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // Stop after current tasks complete
  app.post("/api/orchestrator/stop-after-current", (req: Request, res: Response) => {
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    orchestrator.stopAfterCurrent()
    res.json({
      ok: true,
      state: orchestrator.getState(),
    })
  })

  // Cancel pending stop-after-current
  app.post("/api/orchestrator/cancel-stop", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspace as string | undefined
      const orchestrator = ctx.getOrchestrator(workspaceId)

      if (!orchestrator) {
        res.status(404).json({ error: "Orchestrator not configured" })
        return
      }

      await orchestrator.cancelStopAfterCurrent()
      res.json({
        ok: true,
        state: orchestrator.getState(),
      })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Worker routes ───────────────────────────────────────────────────

  // List all active workers
  app.get("/api/workers", (req: Request, res: Response) => {
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    res.json({
      workers: orchestrator.getWorkerStates(),
    })
  })

  // Get specific worker state
  app.get("/api/workers/:name", (req: Request, res: Response) => {
    const workerName = param(req, "name")
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    const state = orchestrator.getWorkerState(workerName)
    if (!state) {
      res.status(404).json({ error: `Worker "${workerName}" not found` })
      return
    }

    const workerStates = orchestrator.getWorkerStates()
    const workerInfo = workerStates[workerName]

    res.json({
      workerName,
      state,
      currentWorkId: workerInfo?.currentWorkId ?? null,
    })
  })

  // Pause a specific worker
  app.post("/api/workers/:name/pause", (req: Request, res: Response) => {
    const workerName = param(req, "name")
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    const state = orchestrator.getWorkerState(workerName)
    if (!state) {
      res.status(404).json({ error: `Worker "${workerName}" not found` })
      return
    }

    orchestrator.pauseWorker(workerName)
    res.json({
      ok: true,
      workerName,
      state: orchestrator.getWorkerState(workerName),
    })
  })

  // Resume a paused worker
  app.post("/api/workers/:name/resume", (req: Request, res: Response) => {
    const workerName = param(req, "name")
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    const state = orchestrator.getWorkerState(workerName)
    if (!state) {
      res.status(404).json({ error: `Worker "${workerName}" not found` })
      return
    }

    orchestrator.resumeWorker(workerName)
    res.json({
      ok: true,
      workerName,
      state: orchestrator.getWorkerState(workerName),
    })
  })

  // Stop a specific worker
  app.post("/api/workers/:name/stop", (req: Request, res: Response) => {
    const workerName = param(req, "name")
    const workspaceId = req.query.workspace as string | undefined
    const orchestrator = ctx.getOrchestrator(workspaceId)

    if (!orchestrator) {
      res.status(404).json({ error: "Orchestrator not configured" })
      return
    }

    const state = orchestrator.getWorkerState(workerName)
    if (!state) {
      res.status(404).json({ error: `Worker "${workerName}" not found` })
      return
    }

    orchestrator.stopWorker(workerName)
    res.json({
      ok: true,
      workerName,
    })
  })
}
