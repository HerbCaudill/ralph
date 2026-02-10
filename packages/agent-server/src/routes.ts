import type { Express, Request, Response } from "express"
import type { ChatSessionManager, SessionInfo } from "./ChatSessionManager.js"
import { getAvailableAdapters } from "./AdapterRegistry.js"
import { registerPromptRoutes } from "./routes/promptRoutes.js"
import { getSessionSummary } from "./lib/getSessionSummary.js"

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
      const { adapter, cwd, app, systemPrompt } = req.body as {
        adapter?: string
        cwd?: string
        app?: string
        systemPrompt?: string
      }
      const result = await ctx
        .getSessionManager()
        .createSession({ adapter, cwd, app, systemPrompt })
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
      const manager = ctx.getSessionManager()
      const persister = manager.getPersister()

      // Get the session's app namespace so we can read from the correct directory
      const sessionInfo = manager.getSessionInfo(sessionId)
      const app = sessionInfo?.app

      const events =
        since ?
          await persister.readEventsSince(sessionId, since, app)
        : await persister.readEvents(sessionId, app)

      res.json({ events })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // Get the latest session (must be registered before /:id to avoid shadowing)
  app.get("/api/sessions/latest", (_req: Request, res: Response) => {
    const sessions = ctx.getSessionManager().listSessions()
    if (sessions.length === 0) {
      res.status(404).json({ error: "No sessions found" })
      return
    }
    // Sort by createdAt descending, return the most recently created session
    const latest = sessions.sort((a, b) => b.createdAt - a.createdAt)[0]
    res.json(latest)
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

  // List all sessions (optionally filtered by app)
  app.get("/api/sessions", async (req: Request, res: Response) => {
    const appFilter = req.query.app as string | undefined
    const includeSummary = req.query.include === "summary"
    const sessions = ctx.getSessionManager().listSessions(appFilter)

    if (includeSummary) {
      const persister = ctx.getSessionManager().getPersister()
      const sessionsWithSummary = await Promise.all(
        sessions.map(async session => {
          const summary = await getSessionSummary(session.sessionId, persister, session.app)
          return summary ? { ...session, taskId: summary.taskId } : session
        }),
      )
      res.json({ sessions: sessionsWithSummary })
    } else {
      res.json({ sessions })
    }
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

  // Register prompt routes
  registerPromptRoutes(app, ctx)
}
