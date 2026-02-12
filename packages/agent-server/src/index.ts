import express, { type Express } from "express"
import { createServer, type Server } from "node:http"
import { WebSocketServer, type WebSocket } from "ws"
import type { AgentServerConfig } from "./types.js"
import { ChatSessionManager } from "./ChatSessionManager.js"
import { registerRoutes } from "./routes.js"
import { handleWsConnection, type WsClient } from "./wsHandler.js"
import { getDefaultStorageDir } from "@herbcaudill/ralph-shared/server"

// ── Type exports ─────────────────────────────────────────────────────

export type { AgentServerConfig } from "./types.js"

// ── Agent types ──────────────────────────────────────────────────────

export { AgentAdapter } from "./agentTypes.js"
export type {
  ConversationContext,
  ConversationMessage,
  AgentStartOptions,
  AgentMessage,
  AgentInfo,
  AgentAdapterEvents,
} from "./agentTypes.js"

// Re-export event types from shared package
export type {
  AgentEvent,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
  AgentStatus,
} from "./agentTypes.js"

export {
  isAgentMessageEvent,
  isAgentThinkingEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "./agentTypes.js"

// ── Adapters ─────────────────────────────────────────────────────────

export { ClaudeAdapter, buildCwdContext, DEFAULT_CLAUDE_MODEL } from "./ClaudeAdapter.js"
export type { ClaudeAdapterOptions, QueryFn, RetryConfig } from "./ClaudeAdapter.js"

export { CodexAdapter } from "./CodexAdapter.js"
export type { CodexAdapterOptions, CodexFactory } from "./CodexAdapter.js"

export {
  registerAdapter,
  unregisterAdapter,
  getRegisteredAdapters,
  isAdapterRegistered,
  getAdapterRegistration,
  createAdapter,
  isAdapterAvailable,
  getAvailableAdapters,
  getFirstAvailableAdapter,
  registerDefaultAdapters,
  clearRegistry,
} from "./AdapterRegistry.js"
export type { AdapterFactory, AdapterRegistration, AdapterAvailability } from "./AdapterRegistry.js"

// ── Session management ───────────────────────────────────────────────

export { SessionPersister } from "@herbcaudill/ralph-shared/server"
export { ChatSessionManager } from "./ChatSessionManager.js"
export type {
  SessionInfo,
  CreateSessionOptions,
  SendMessageOptions,
  ChatSessionManagerEvents,
  ChatSessionManagerOptions,
} from "./ChatSessionManager.js"

// ── Routes and WebSocket ─────────────────────────────────────────────

export { registerRoutes } from "./routes.js"
export type { RouteContext } from "./routes.js"
export { registerOrchestratorRoutes } from "./routes/orchestratorRoutes.js"
export type { OrchestratorRouteContext } from "./routes/orchestratorRoutes.js"
export { handleWsConnection } from "./wsHandler.js"
export type { WsClient, WsHandlerOptions } from "./wsHandler.js"

// ── Utilities ────────────────────────────────────────────────────────

export { findClaudeExecutable } from "./findClaudeExecutable.js"
export { isRetryableError } from "./lib/isRetryableError.js"
export { calculateBackoffDelay } from "./lib/calculateBackoffDelay.js"
export { generateId } from "./lib/generateId.js"
export { loadClaudeMd, loadClaudeMdSync, CLAUDE_MD_FILENAME } from "./lib/loadClaudeMd.js"
export type { LoadClaudeMdOptions } from "./lib/loadClaudeMd.js"
export { getDefaultStorageDir } from "@herbcaudill/ralph-shared/server"
export {
  loadContextFile,
  loadContextFileSync,
  getContextFilename,
  getGlobalConfigDir,
} from "./lib/loadContextFile.js"
export type { AdapterType, LoadContextFileOptions } from "./lib/loadContextFile.js"
export { assemblePrompt } from "./lib/loadPrompt.js"
export type { AssemblePromptOptions } from "./lib/loadPrompt.js"
export { registerPromptRoutes } from "./routes/promptRoutes.js"
export type { PromptRouteContext } from "./routes/promptRoutes.js"
export { parseTaskLifecycleEvent } from "./lib/parseTaskLifecycleEvent.js"
export type { TaskLifecycleEventData } from "./lib/parseTaskLifecycleEvent.js"

// ── Worktree management ─────────────────────────────────────────────

export { WorktreeManager } from "./lib/WorktreeManager.js"
export type {
  WorktreeInfo,
  CreateWorktreeOptions,
  RemoveWorktreeOptions,
  MergeResult,
  CleanupResult,
} from "./lib/WorktreeManager.js"

// ── Worker loop ─────────────────────────────────────────────────────

export { WorkerLoop } from "./lib/WorkerLoop.js"
export type {
  WorkerLoopOptions,
  WorkerLoopEvents,
  RunAgentResult,
  TestResult,
  MergeConflictContext,
  WorkerState,
} from "./lib/WorkerLoop.js"

// ── Worker orchestrator ──────────────────────────────────────────────

export { WorkerOrchestrator } from "./lib/WorkerOrchestrator.js"
export type {
  WorkerOrchestratorOptions,
  WorkerOrchestratorEvents,
  OrchestratorState,
  WorkerInfo,
} from "./lib/WorkerOrchestrator.js"

export { WorkerOrchestratorManager } from "./lib/WorkerOrchestratorManager.js"
export type {
  WorkerOrchestratorManagerOptions,
  WorkerOrchestratorManagerEvents,
  TaskSource,
} from "./lib/WorkerOrchestratorManager.js"

// ── Server ───────────────────────────────────────────────────────────

/** Module state: connected WebSocket clients. */
const wsClients = new Set<WsClient>()

/**
 * Check if a port is available by attempting to listen on it.
 */
async function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const tester = createServer()
    tester.once("error", () => resolve(false))
    tester.once("listening", () => {
      tester.close(() => resolve(true))
    })
    tester.listen(port, host)
  })
}

/** Find the first available port starting from the given port. */
export async function findAvailablePort(
  /** Hostname to check. */
  host: string,
  /** Port to start checking from. */
  startPort: number,
): Promise<number> {
  let port = startPort
  while (!(await isPortAvailable(host, port))) {
    port++
    if (port > startPort + 100) {
      throw new Error(`No available port found in range ${startPort}-${port}`)
    }
  }
  return port
}

/** Read agent server configuration from environment variables. */
export function getConfig(): AgentServerConfig {
  return {
    host: process.env.AGENT_SERVER_HOST ?? "localhost",
    port: Number(process.env.AGENT_SERVER_PORT ?? 4244),
    storageDir: process.env.AGENT_STORAGE_DIR,
    cwd: process.env.WORKSPACE_PATH ?? process.cwd(),
  }
}

/**
 * Start the agent server with the given configuration.
 * Returns an object with the Express app, HTTP server, and a close function.
 */
export async function startServer(config: AgentServerConfig): Promise<{
  app: Express
  server: Server
  sessionManager: ChatSessionManager
  close: () => Promise<void>
}> {
  const app = express()
  app.use(express.json())

  const server = createServer(app)

  // WebSocket server
  const wss = new WebSocketServer({ server, path: "/ws" })

  // Session manager
  const storageDir = config.storageDir ?? getDefaultStorageDir()
  const sessionManager = new ChatSessionManager({
    storageDir,
    cwd: config.cwd,
  })

  // Register HTTP routes
  registerRoutes(app, {
    getSessionManager: () => sessionManager,
  })

  // Register custom routes if provided
  config.customRoutes?.(app)

  // Handle WebSocket connections.
  // The getOrchestrator callback reads lazily from app.locals so that
  // customRoutes (or post-startup code) can set it after startServer returns.
  wss.on("connection", (ws: WebSocket) => {
    handleWsConnection(ws, wsClients, {
      getSessionManager: () => sessionManager,
      getOrchestrator: workspaceId => {
        const getter = app.locals.getOrchestrator as
          | ((
              wid?: string,
            ) => import("./lib/WorkerOrchestratorManager.js").WorkerOrchestratorManager | null)
          | undefined
        return getter?.(workspaceId) ?? null
      },
    })
  })

  // Start listening
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(config.port, config.host, () => {
      console.log(`[agent-server] listening on http://${config.host}:${config.port}`)
      resolve()
    })
  })

  // Graceful shutdown
  const close = async () => {
    console.log("[agent-server] shutting down...")
    for (const client of wsClients) {
      client.ws.close()
    }
    wsClients.clear()
    wss.close()
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()))
    })
    console.log("[agent-server] stopped")
  }

  const handleSignal = () => {
    close().then(() => process.exit(0))
  }
  process.on("SIGINT", handleSignal)
  process.on("SIGTERM", handleSignal)

  return { app, server, sessionManager, close }
}
