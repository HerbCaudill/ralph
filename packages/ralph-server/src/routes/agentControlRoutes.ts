import type { Express, Request, Response } from "express"
import type { AgentRouteContext } from "./types.js"
import { serializeInstanceState } from "./types.js"

/**
 * Register global agent control routes on an Express app.
 * These are the legacy single-instance control endpoints.
 *
 * Routes:
 * - POST /api/start
 * - POST /api/stop
 * - POST /api/pause
 * - POST /api/resume
 * - POST /api/stop-after-current
 * - POST /api/cancel-stop-after-current
 * - POST /api/message
 * - GET  /api/status
 */
export function registerAgentControlRoutes(app: Express, ctx: AgentRouteContext): void {
  app.post("/api/start", async (req: Request, res: Response) => {
    try {
      const manager = ctx.getRalphManager()
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
      const manager = ctx.getRalphManager()
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
      const manager = ctx.getRalphManager()
      manager.pause()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/resume", (_req: Request, res: Response) => {
    try {
      const manager = ctx.getRalphManager()
      manager.resume()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/stop-after-current", (_req: Request, res: Response) => {
    try {
      const manager = ctx.getRalphManager()
      manager.stopAfterCurrent()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop after current"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/cancel-stop-after-current", async (_req: Request, res: Response) => {
    try {
      const manager = ctx.getRalphManager()
      await manager.cancelStopAfterCurrent()
      res.status(200).json({ ok: true, status: manager.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel stop after current"
      res.status(500).json({ ok: false, error: message })
    }
  })

  app.post("/api/message", (req: Request, res: Response) => {
    try {
      const manager = ctx.getRalphManager()
      if (!manager.canAcceptMessages) {
        res.status(409).json({ ok: false, error: "Ralph is not running" })
        return
      }

      const { message } = req.body as { message?: string | object }
      if (message === undefined) {
        res.status(400).json({ ok: false, error: "Message is required" })
        return
      }

      const payload = typeof message === "string" ? { type: "message", text: message } : message
      manager.send(payload)
      res.status(200).json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message"
      res.status(500).json({ ok: false, error: msg })
    }
  })

  app.get("/api/status", (_req: Request, res: Response) => {
    const manager = ctx.getRalphManager()
    res.status(200).json({ ok: true, status: manager.status })
  })
}
