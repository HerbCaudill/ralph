/**
 * Wrapper entry point that starts the agent-server with Ralph-specific routes
 * and wires up the worker orchestrator for concurrent agent sessions.
 */
import { startServer, getConfig, type WsClient } from "@herbcaudill/agent-server"
import { getWorkspaceId } from "@herbcaudill/beads-sdk"
import type { WebSocket } from "ws"
import { registerRalphRoutes } from "./ralphRoutes.js"
import { createBeadsTaskSource } from "./createBeadsTaskSource.js"
import { WorkerOrchestratorManager } from "./lib/WorkerOrchestratorManager.js"
import {
  handleOrchestratorWsMessage,
  setupOrchestratorEventForwarding,
  type OrchestratorWsClient,
} from "./lib/orchestratorWsHandler.js"

/** Get the beads-server URL from environment variables. */
function getBeadsServerUrl(): string {
  if (process.env.VITE_BEADS_SERVER_URL) return process.env.VITE_BEADS_SERVER_URL
  const port = process.env.BEADS_PORT ?? "4243"
  return `http://localhost:${port}`
}

async function main() {
  try {
    const config = getConfig()

    // Set up orchestrator factory keyed by workspace ID.
    // Orchestrators are created lazily on first request for a given workspace.
    // Defined before startServer so the customWsHandler closure can capture it.
    const orchestrators = new Map<string, WorkerOrchestratorManager>()
    const beadsServerUrl = getBeadsServerUrl()
    const defaultWorkspacePath = config.cwd ?? process.cwd()
    const defaultWorkspaceId = getWorkspaceId({ workspacePath: defaultWorkspacePath })

    // Deferred reference — filled after startServer returns the sessionManager.
    let sessionManagerRef: import("@herbcaudill/agent-server").ChatSessionManager | null = null

    /** Lazily create or retrieve an orchestrator for a workspace. */
    const getOrchestrator = (workspaceId?: string): WorkerOrchestratorManager | null => {
      if (!sessionManagerRef) return null

      const targetId = workspaceId ?? defaultWorkspaceId
      const existing = orchestrators.get(targetId)
      if (existing) return existing

      // For now, only support the default workspace (whose path we know).
      if (targetId !== defaultWorkspaceId) return null

      const taskSource = createBeadsTaskSource(beadsServerUrl, defaultWorkspacePath)
      const orchestrator = new WorkerOrchestratorManager({
        mainWorkspacePath: defaultWorkspacePath,
        taskSource,
        sessionManager: sessionManagerRef,
        maxWorkers: 3,
      })
      orchestrators.set(targetId, orchestrator)
      return orchestrator
    }

    const { app, sessionManager } = await startServer({
      ...config,
      customRoutes: registerRalphRoutes,
      customWsHandler: (ws: WebSocket, client: WsClient) => {
        let forwardingCleanup: (() => void) | undefined

        return {
          onMessage(msg: Record<string, unknown>) {
            // Set workspaceId on client from orchestrator messages
            if (msg.workspaceId && !client.workspaceId) {
              client.workspaceId = msg.workspaceId as string
            }

            // Set up event forwarding on first subscribe
            if (msg.type === "subscribe_orchestrator" && !forwardingCleanup) {
              const orchestrator = getOrchestrator(client.workspaceId)
              if (orchestrator) {
                forwardingCleanup = setupOrchestratorEventForwarding(
                  client as unknown as OrchestratorWsClient,
                  orchestrator,
                )
              }
            }

            return handleOrchestratorWsMessage(msg, ws, client as unknown as OrchestratorWsClient, {
              getOrchestrator,
            })
          },
          onClose() {
            forwardingCleanup?.()
          },
        }
      },
    })

    // Now that we have the sessionManager, fill the deferred reference
    sessionManagerRef = sessionManager

    // Also expose on app.locals for the REST routes
    app.locals.getOrchestrator = getOrchestrator
  } catch (err) {
    console.error("[agent-server] startup error:", err)
    process.exitCode = 1
  }
}

main()
