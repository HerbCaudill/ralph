import type { Express, Request, Response } from "express"
import type { ChatSessionManager } from "./ChatSessionManager.js"
import { getAvailableAdapters } from "./AdapterRegistry.js"

/** Context for route handlers. */
export interface RouteContext {
  /** Get the ChatSessionManager instance. */
  getSessionManager: () => ChatSessionManager
}

/** Extract a route param as a string. */
function param(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

/** Register all HTTP routes on an Express app. */
export function registerRoutes(
  /** The Express app. */
  app: Express,
  /** Route handler context. */
  ctx: RouteContext,
): void {
  // Create a new session
  app.post("/api/sessions", async (req: Request, res: Response) => {
    try {
      const { adapter, cwd } = req.body as { adapter?: string; cwd?: string }
      const result = await ctx.getSessionManager().createSession({ adapter, cwd })
      res.status(201).json(result)
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  // Send a message to a session
  app.post("/api/sessions/:id/messages", async (req: Request, res: Response) => {
    try {
      const { message, systemPrompt, model } = req.body as {
        message?: string
        systemPrompt?: string
        model?: string
      }

      if (!message?.trim()) {
        res.status(400).json({ error: "Message is required" })
        return
      }

      const sessionId = param(req, "id")
      // Fire and forget — events are streamed via WebSocket
      ctx
        .getSessionManager()
        .sendMessage(sessionId, message.trim(), { systemPrompt, model })
        .catch(() => {
          // Errors are emitted via the event system
        })
      res.status(202).json({ ok: true })
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  // Get event history for a session
  app.get("/api/sessions/:id/events", async (req: Request, res: Response) => {
    try {
      const sessionId = param(req, "id")
      const since = req.query.since ? Number(req.query.since) : undefined
      const persister = ctx.getSessionManager().getPersister()

      const events = since
        ? await persister.readEventsSince(sessionId, since)
        : await persister.readEvents(sessionId)

      res.json({ events })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // Get session info
  app.get("/api/sessions/:id", (req: Request, res: Response) => {
    const info = ctx.getSessionManager().getSessionInfo(param(req, "id"))
    if (!info) {
      res.status(404).json({ error: "Session not found" })
      return
    }
    res.json(info)
  })

  // List all sessions
  app.get("/api/sessions", (_req: Request, res: Response) => {
    res.json({ sessions: ctx.getSessionManager().listSessions() })
  })

  // Get the latest session
  app.get("/api/sessions/latest", (_req: Request, res: Response) => {
    const persister = ctx.getSessionManager().getPersister()
    const sessionId = persister.getLatestSessionId()
    if (!sessionId) {
      res.status(404).json({ error: "No sessions found" })
      return
    }
    const info = ctx.getSessionManager().getSessionInfo(sessionId)
    res.json(info ?? { sessionId })
  })

  // Delete/clear a session
  app.delete("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      await ctx.getSessionManager().clearSession(param(req, "id"))
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // List available adapters
  app.get("/api/adapters", async (_req: Request, res: Response) => {
    res.json({ adapters: await getAvailableAdapters() })
  })

  // Health check
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true, server: "agent-server" })
  })
}
