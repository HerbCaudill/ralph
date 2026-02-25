import type { WebSocket, RawData } from "ws"
import type { ChatSessionManager } from "./ChatSessionManager.js"
import type { AgentEvent } from "./agentTypes.js"

/** A connected WebSocket client. */
export interface WsClient {
  /** The WebSocket connection. */
  ws: WebSocket
  /** Session IDs this client is subscribed to. */
  subscribedSessions: Set<string>
  /** Workspace ID this client is associated with (owner/repo format). */
  workspaceId?: string
}

/** Per-connection handlers returned by the onConnection hook. */
export interface WsConnectionHandlers {
  /** Handle custom message types. Return true if handled. */
  onMessage?: (msg: Record<string, unknown>) => boolean
  /** Cleanup function called on disconnect. */
  onClose?: () => void
}

/** Options for setting up WebSocket handling. */
export interface WsHandlerOptions {
  /** Get the ChatSessionManager instance. */
  getSessionManager: () => ChatSessionManager
  /** Called for each new WebSocket connection. Can return per-connection handlers for custom message types. */
  onConnection?: (ws: WebSocket, client: WsClient) => WsConnectionHandlers | void
}

/**
 * Handle a new WebSocket connection.
 * Manages message routing for the session-based protocol.
 */
export function handleWsConnection(
  /** The WebSocket connection. */
  ws: WebSocket,
  /** Connected clients set (for cleanup). */
  clients: Set<WsClient>,
  /** Handler options. */
  options: WsHandlerOptions,
): void {
  const client: WsClient = { ws, subscribedSessions: new Set() }
  clients.add(client)

  const connectionHandlers = options.onConnection?.(ws, client)
  const manager = options.getSessionManager()

  // Forward events for subscribed sessions (include workspaceId if set)
  const onEvent = (sessionId: string, event: AgentEvent) => {
    if (client.subscribedSessions.has(sessionId) && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "event",
          sessionId,
          event,
          ...(client.workspaceId && { workspaceId: client.workspaceId }),
        }),
      )
    }
  }

  const onStatus = (sessionId: string, status: string) => {
    if (client.subscribedSessions.has(sessionId) && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "status",
          sessionId,
          status,
          ...(client.workspaceId && { workspaceId: client.workspaceId }),
        }),
      )
    }
  }

  const onError = (sessionId: string, error: Error) => {
    if (client.subscribedSessions.has(sessionId) && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "error",
          sessionId,
          error: error.message,
          ...(client.workspaceId && { workspaceId: client.workspaceId }),
        }),
      )
    }
  }

  manager.on("event", onEvent)
  manager.on("status", onStatus)
  manager.on("error", onError)

  ws.on("message", (raw: RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>

      switch (msg.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }))
          break

        case "create_session":
          // Track workspace ID if provided
          if (msg.workspaceId) {
            client.workspaceId = msg.workspaceId as string
          }
          manager
            .createSession({
              adapter: msg.adapter as string | undefined,
              cwd: msg.cwd as string | undefined,
              app: msg.app as string | undefined,
              systemPrompt: msg.systemPrompt as string | undefined,
              allowedTools: msg.allowedTools as string[] | undefined,
            })
            .then(result => {
              client.subscribedSessions.add(result.sessionId)
              ws.send(
                JSON.stringify({
                  type: "session_created",
                  sessionId: result.sessionId,
                  workspaceId: client.workspaceId,
                }),
              )
            })
            .catch(err => {
              ws.send(JSON.stringify({ type: "error", error: (err as Error).message }))
            })
          break

        case "message": {
          const sessionId = msg.sessionId as string
          const message = msg.message as string
          if (!sessionId || !message) {
            ws.send(JSON.stringify({ type: "error", error: "sessionId and message are required" }))
            break
          }
          // Auto-subscribe to this session
          client.subscribedSessions.add(sessionId)
          manager
            .sendMessage(sessionId, message, {
              systemPrompt: msg.systemPrompt as string | undefined,
              model: msg.model as string | undefined,
              isSystemPrompt: msg.isSystemPrompt as boolean | undefined,
            })
            .catch(err => {
              ws.send(JSON.stringify({ type: "error", sessionId, error: (err as Error).message }))
            })
          break
        }

        case "reconnect": {
          const sessionId = msg.sessionId as string
          if (!sessionId) {
            ws.send(JSON.stringify({ type: "error", error: "sessionId is required" }))
            break
          }
          client.subscribedSessions.add(sessionId)

          // Get the session's app/workspace so we can read from the correct directory
          const sessionInfo = manager.getSessionInfo(sessionId)
          const app = sessionInfo?.app
          const workspace = sessionInfo?.workspace

          const lastTimestamp = msg.lastEventTimestamp as number | undefined
          const persister = manager.getPersister()
          const eventsPromise =
            lastTimestamp ?
              persister.readEventsSince(sessionId, lastTimestamp, app, workspace)
            : persister.readEvents(sessionId, app, workspace)

          eventsPromise
            .then(events => {
              ws.send(JSON.stringify({ type: "pending_events", sessionId, events }))
            })
            .catch(err => {
              ws.send(JSON.stringify({ type: "error", sessionId, error: (err as Error).message }))
            })
          break
        }

        case "clear": {
          const sessionId = msg.sessionId as string
          if (!sessionId) {
            ws.send(JSON.stringify({ type: "error", error: "sessionId is required" }))
            break
          }
          manager
            .clearSession(sessionId)
            .then(() => {
              client.subscribedSessions.delete(sessionId)
              ws.send(JSON.stringify({ type: "session_cleared", sessionId }))
            })
            .catch(err => {
              ws.send(JSON.stringify({ type: "error", sessionId, error: (err as Error).message }))
            })
          break
        }

        case "interrupt": {
          const sessionId = msg.sessionId as string
          if (!sessionId) {
            ws.send(JSON.stringify({ type: "error", error: "sessionId is required" }))
            break
          }
          manager.interruptSession(sessionId).catch(err => {
            ws.send(JSON.stringify({ type: "error", sessionId, error: (err as Error).message }))
          })
          break
        }

        // Backward compatibility: support the old chat_message protocol
        case "chat_message": {
          const message = msg.message as string
          if (!message) break

          // Get or create a session for this client
          const existingSession = Array.from(client.subscribedSessions)[0]
          if (existingSession) {
            manager.sendMessage(existingSession, message).catch(err => {
              ws.send(JSON.stringify({ type: "error", error: (err as Error).message }))
            })
          } else {
            // Auto-create session then send
            manager
              .createSession({
                adapter: msg.agentType as string | undefined,
                app: msg.app as string | undefined,
                allowedTools: msg.allowedTools as string[] | undefined,
              })
              .then(result => {
                client.subscribedSessions.add(result.sessionId)
                return manager.sendMessage(result.sessionId, message)
              })
              .catch(err => {
                ws.send(JSON.stringify({ type: "error", error: (err as Error).message }))
              })
          }
          break
        }

        case "clear_history": {
          // Backward compat: clear all subscribed sessions
          for (const sessionId of client.subscribedSessions) {
            manager.clearSession(sessionId).catch(() => {})
          }
          client.subscribedSessions.clear()
          break
        }

        default:
          // Delegate to custom handler if provided
          connectionHandlers?.onMessage?.(msg)
          break
      }
    } catch {
      // Ignore malformed messages
    }
  })

  ws.on("close", () => {
    connectionHandlers?.onClose?.()
    manager.off("event", onEvent)
    manager.off("status", onStatus)
    manager.off("error", onError)
    clients.delete(client)
  })

  ws.send(JSON.stringify({ type: "connected" }))
}
