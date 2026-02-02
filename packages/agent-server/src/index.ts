import express, { type Express, type Request, type Response } from "express"
import { createServer, type Server } from "node:http"
import { WebSocketServer, type WebSocket, type RawData } from "ws"
import type { AgentServerConfig, WsClient } from "./types.js"
import { TaskChatManager } from "./TaskChatManager.js"
import { registerTaskChatRoutes } from "./routes/taskChatRoutes.js"

export type { AgentServerConfig, WsClient } from "./types.js"

// ── Re-exports: extracted agent manager modules ─────────────────────

export { RalphManager } from "./RalphManager.js"
export type { RalphStatus, RalphEvent, SpawnFn, RalphManagerOptions } from "./RalphManager.js"

export { RalphRegistry, eventsToConversationContext } from "./RalphRegistry.js"
export type {
  MergeConflict,
  RalphInstanceState,
  CreateInstanceOptions,
  RalphRegistryOptions,
} from "./RalphRegistry.js"

export { InstanceStore, getInstanceStore, resetInstanceStores } from "./InstanceStore.js"
export type { PersistedInstance } from "./InstanceStore.js"

export {
  SessionEventPersister,
  getSessionEventPersister,
  resetSessionEventPersisters,
} from "./SessionEventPersister.js"

export {
  SessionStateStore,
  getSessionStateStore,
  resetSessionStateStores,
} from "./SessionStateStore.js"
export type { PersistedSessionState } from "./SessionStateStore.js"

export { SessionRunner } from "./SessionRunner.js"
export type { SessionStatus, SessionRunnerOptions, SessionRunnerEvents } from "./SessionRunner.js"

export { WorktreeManager } from "./WorktreeManager.js"
export type {
  WorktreeInfo,
  CreateWorktreeOptions,
  MergeResult,
  CleanupResult,
  PostSessionResult,
  WorktreeStatus,
} from "./WorktreeManager.js"

export { findClaudeExecutable } from "./findClaudeExecutable.js"

export {
  loadSystemPrompt,
  loadTaskChatSkill,
  getTaskChatAllowedTools,
  getTaskChatModel,
} from "./systemPrompt.js"

export { loadSkill, hasCustomSkill, getCustomSkillPath } from "./loadSkill.js"
export type { SkillMetadata, LoadSkillResult } from "./loadSkill.js"

// Re-export agent types
export { AgentAdapter } from "./agentTypes.js"
export type {
  ConversationContext,
  ConversationMessage,
  AgentStartOptions,
  AgentMessage,
  AgentInfo,
  AgentAdapterEvents,
  AgentEvent,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
  AgentStatus,
  BdProxy,
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

// ── Re-exports: extracted adapter modules ────────────────────────────

export { ClaudeAdapter, buildCwdContext } from "./ClaudeAdapter.js"
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

// ── Re-exports: extracted task chat modules ──────────────────────────

export { TaskChatManager } from "./TaskChatManager.js"
export type {
  TaskChatStatus,
  TaskChatMessage,
  TaskChatEvent,
  TaskChatToolUse,
  GetBdProxyFn,
  TaskChatManagerOptions,
} from "./TaskChatManager.js"

export { TaskChatEventLog } from "./TaskChatEventLog.js"
export type {
  TaskChatLogEntry,
  TaskChatLogSummary,
  TaskChatEventLogOptions,
} from "./TaskChatEventLog.js"

export {
  TaskChatEventPersister,
  getTaskChatEventPersister,
  resetTaskChatEventPersisters,
} from "./TaskChatEventPersister.js"

// ── Re-exports: utility functions ────────────────────────────────────

export { isRetryableError } from "./lib/isRetryableError.js"
export { calculateBackoffDelay } from "./lib/calculateBackoffDelay.js"
export { createEventStream } from "./lib/createEventStream.js"
export { createMessageStream } from "./lib/createMessageStream.js"
export { generateId } from "./lib/generateId.js"

// ── Re-exports: HTTP route modules ──────────────────────────────────

export {
  registerAgentRoutes,
  registerAgentControlRoutes,
  registerInstanceRoutes,
  registerTaskChatRoutes,
  serializeInstanceState,
} from "./routes/index.js"
export type { AgentRouteContext } from "./routes/index.js"

// ── Re-exports: WebSocket handler module ────────────────────────────

export { handleAgentWsMessage, sendWelcomeMessage } from "./AgentWsHandler.js"
export type { AgentWsHandlerOptions, AgentWsClient } from "./AgentWsHandler.js"

// ── Re-exports: workspace context modules ───────────────────────────

export { AgentWorkspaceContext } from "./AgentWorkspaceContext.js"
export type { AgentWorkspaceContextOptions } from "./AgentWorkspaceContext.js"

export { AgentWorkspaceContextManager } from "./AgentWorkspaceContextManager.js"
export type { AgentWorkspaceContextManagerOptions } from "./AgentWorkspaceContextManager.js"

// ── Module state ──────────────────────────────────────────────────────

/** Connected WebSocket clients. */
const wsClients = new Set<WsClient>()

// ── Helpers ───────────────────────────────────────────────────────────

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

/**
 * Find the first available port starting from the given port.
 */
export async function findAvailablePort(host: string, startPort: number): Promise<number> {
  let port = startPort
  while (!(await isPortAvailable(host, port))) {
    port++
    if (port > startPort + 100) {
      throw new Error(`No available port found in range ${startPort}-${port}`)
    }
  }
  return port
}

// ── Configuration ────────────────────────────────────────────────────

/**
 * Read agent server configuration from environment variables.
 */
export function getConfig(): AgentServerConfig {
  return {
    host: process.env.AGENT_SERVER_HOST ?? "localhost",
    port: Number(process.env.AGENT_SERVER_PORT ?? 4244),
    workspacePath: process.env.WORKSPACE_PATH ?? process.cwd(),
  }
}

// ── Server ───────────────────────────────────────────────────────────

/**
 * Broadcast a message to all connected WebSocket clients.
 */
function broadcast(message: object): void {
  const data = JSON.stringify(message)
  for (const client of wsClients) {
    if (client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(data)
    }
  }
}

/**
 * Start the agent server with the given configuration.
 * Returns an object with the Express app, HTTP server, and a close function.
 */
export async function startServer(config: AgentServerConfig): Promise<{
  app: Express
  server: Server
  close: () => Promise<void>
}> {
  const app = express()
  app.use(express.json())

  const server = createServer(app)

  // ── WebSocket server ────────────────────────────────────────────────
  const wss = new WebSocketServer({ server, path: "/ws" })

  // ── TaskChatManager (shared across all WS clients) ─────────────────
  const taskChatManager = new TaskChatManager({
    cwd: config.workspacePath,
  })

  // Forward TaskChatManager events to all connected WS clients
  taskChatManager.on("status", (status: string) => {
    broadcast({ type: "status", status })
  })

  taskChatManager.on("message", (msg: { role: string; content: string; timestamp: number }) => {
    if (msg.role === "assistant") {
      broadcast({
        type: "event",
        event: { type: "assistant_text", text: msg.content, timestamp: msg.timestamp },
      })
    }
  })

  taskChatManager.on("chunk", (text: string) => {
    broadcast({
      type: "event",
      event: { type: "assistant_text", text, timestamp: Date.now() },
    })
  })

  taskChatManager.on(
    "tool_use",
    (toolUse: {
      toolUseId: string
      tool: string
      input: Record<string, unknown>
      status: string
      timestamp: number
      sequence: number
    }) => {
      broadcast({
        type: "event",
        event: { type: "tool_use", ...toolUse },
      })
    },
  )

  taskChatManager.on(
    "tool_result",
    (toolResult: {
      toolUseId: string
      tool: string
      output?: string
      error?: string
      status: string
      timestamp: number
      sequence: number
    }) => {
      broadcast({
        type: "event",
        event: { type: "tool_result", ...toolResult },
      })
    },
  )

  taskChatManager.on("error", (err: Error) => {
    broadcast({ type: "error", error: err.message })
  })

  wss.on("connection", (ws: WebSocket) => {
    const client: WsClient = { ws, subscribedSessions: new Set() }
    wsClients.add(client)

    ws.on("message", (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString())

        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }))
          return
        }

        if (msg.type === "chat_message" && typeof msg.message === "string") {
          taskChatManager.sendMessage(msg.message).catch((err: Error) => {
            ws.send(JSON.stringify({ type: "error", error: err.message }))
          })
          return
        }

        if (msg.type === "clear_history") {
          taskChatManager.clearHistory()
          return
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on("close", () => {
      wsClients.delete(client)
    })

    ws.send(JSON.stringify({ type: "connected" }))
  })

  // ── Task chat REST routes ──────────────────────────────────────────
  registerTaskChatRoutes(app, {
    getTaskChatManager: () => taskChatManager,
    getRalphRegistry: () => {
      throw new Error("Not available in standalone agent-server")
    },
    getWorkspacePath: () => config.workspacePath ?? process.cwd(),
    logRalphEvents: false,
    isDevMode: () => false,
    getRalphManager: () => {
      throw new Error("Not available in standalone agent-server")
    },
    getTaskChatEventPersister: () => {
      throw new Error("Not available in standalone agent-server")
    },
    getEventHistory: () => [],
    setEventHistory: () => {},
  })

  // ── Health check ────────────────────────────────────────────────────
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true, server: "agent-server" })
  })

  // ── Start listening ─────────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(config.port, config.host, () => {
      console.log(`[agent-server] listening on http://${config.host}:${config.port}`)
      resolve()
    })
  })

  // ── Graceful shutdown ───────────────────────────────────────────────
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

  return { app, server, close }
}
