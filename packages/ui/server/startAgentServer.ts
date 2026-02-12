/**
 * Wrapper entry point that starts the agent-server with Ralph-specific routes
 * and wires up the worker orchestrator for concurrent agent sessions.
 */
import { startServer, getConfig, WorkerOrchestratorManager } from "@herbcaudill/agent-server"
import { getWorkspaceId } from "@herbcaudill/ralph-shared"
import { registerRalphRoutes } from "./ralphRoutes.js"
import { createBeadsTaskSource } from "./createBeadsTaskSource.js"

/** Get the beads-server URL from environment variables. */
function getBeadsServerUrl(): string {
  if (process.env.VITE_BEADS_SERVER_URL) return process.env.VITE_BEADS_SERVER_URL
  const port = process.env.BEADS_PORT ?? "4243"
  return `http://localhost:${port}`
}

async function main() {
  try {
    const config = getConfig()
    const { app, sessionManager } = await startServer({
      ...config,
      customRoutes: registerRalphRoutes,
    })

    // Set up orchestrator factory keyed by workspace ID.
    // Orchestrators are created lazily on first request for a given workspace.
    const orchestrators = new Map<string, WorkerOrchestratorManager>()
    const beadsServerUrl = getBeadsServerUrl()
    const defaultWorkspacePath = config.cwd ?? process.cwd()
    const defaultWorkspaceId = getWorkspaceId({ workspacePath: defaultWorkspacePath })

    app.locals.getOrchestrator = (workspaceId?: string): WorkerOrchestratorManager | null => {
      // Default to the server's own workspace
      const targetId = workspaceId ?? defaultWorkspaceId

      const existing = orchestrators.get(targetId)
      if (existing) return existing

      // For now, only support the default workspace (whose path we know).
      // Multi-workspace support would require resolving workspace IDs to paths.
      if (targetId !== defaultWorkspaceId) return null

      const taskSource = createBeadsTaskSource(beadsServerUrl, defaultWorkspacePath)
      const orchestrator = new WorkerOrchestratorManager({
        mainWorkspacePath: defaultWorkspacePath,
        taskSource,
        sessionManager,
        maxWorkers: 3,
      })
      orchestrators.set(targetId, orchestrator)

      return orchestrator
    }
  } catch (err) {
    console.error("[agent-server] startup error:", err)
    process.exitCode = 1
  }
}

main()
