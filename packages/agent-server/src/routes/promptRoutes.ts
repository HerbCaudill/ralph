import type { Express, Request, Response } from "express"
import type { ChatSessionManager } from "../ChatSessionManager.js"
import { assemblePrompt } from "../lib/loadPrompt.js"

/** Context for prompt route handlers. */
export interface PromptRouteContext {
  /** Get the ChatSessionManager instance. */
  getSessionManager: () => ChatSessionManager
}

/** Extract a route param as a string. */
function param(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

/**
 * Register prompt-related HTTP routes on an Express app.
 */
export function registerPromptRoutes(
  /** The Express app. */
  app: Express,
  /** Route handler context. */
  ctx: PromptRouteContext,
): void {
  /**
   * GET /api/sessions/:id/prompt
   *
   * Returns the assembled prompt for a session, including:
   * - Adapter-specific context file (CLAUDE.md or AGENTS.md)
   * - Session's stored system prompt
   */
  app.get("/api/sessions/:id/prompt", (req: Request, res: Response) => {
    const sessionId = param(req, "id")
    const sessionInfo = ctx.getSessionManager().getSessionInfo(sessionId)

    if (!sessionInfo) {
      res.status(404).json({ error: "Session not found" })
      return
    }

    const prompt = assemblePrompt({
      cwd: sessionInfo.cwd,
      adapter: sessionInfo.adapter,
      systemPrompt: sessionInfo.systemPrompt,
      includeWorkingDirectoryContext: true,
    })

    res.json({
      prompt,
      adapter: sessionInfo.adapter,
      sessionId: sessionInfo.sessionId,
    })
  })
}
