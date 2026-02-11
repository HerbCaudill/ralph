import type { Express, Request, Response } from "express"
import { registerOrchestratorRoutes } from "@herbcaudill/agent-server"
import type { WorkerOrchestratorManager } from "@herbcaudill/agent-server"
import { loadSessionPrompt, TEMPLATES_DIR } from "@herbcaudill/ralph-shared/prompts"

/** Register Ralph-specific routes on the Express app. */
export function registerRalphRoutes(
  /** The Express app to register routes on. */
  app: Express,
): void {
  registerOrchestratorRoutes(app, {
    getOrchestrator: (workspaceId?: string): WorkerOrchestratorManager | null => {
      const getOrchestrator = app.locals.getOrchestrator as
        | ((targetWorkspaceId?: string) => WorkerOrchestratorManager | null)
        | undefined

      return getOrchestrator?.(workspaceId) ?? null
    },
  })

  app.get("/api/prompts/ralph", async (req: Request, res: Response) => {
    try {
      const cwd = (req.query.cwd as string) || process.cwd()
      const { content } = loadSessionPrompt({ templatesDir: TEMPLATES_DIR, cwd })
      res.json({ prompt: content })
    } catch (error) {
      res.status(500).json({ error: (error as Error).message })
    }
  })
}
