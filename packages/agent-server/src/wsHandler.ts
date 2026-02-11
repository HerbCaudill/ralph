import type { WebSocket, RawData } from "ws"
import type { ChatSessionManager } from "./ChatSessionManager.js"
import type { AgentEvent } from "@herbcaudill/ralph-shared"
import type { WorkerOrchestratorManager } from "./lib/WorkerOrchestratorManager.js"

/** A connected WebSocket client. */
export interface WsClient {
  /** The WebSocket connection. */
  ws: WebSocket
  /** Session IDs this client is subscribed to. */
  subscribedSessions: Set<string>
  /** Workspace ID this client is associated with (owner/repo format). */
  workspaceId?: string
  /** Whether this client is subscribed to orchestrator events. */
  subscribedToOrchestrator?: boolean
}

/** Options for setting up WebSocket handling. */
export interface WsHandlerOptions {
  /** Get the ChatSessionManager instance. */
  getSessionManager: () => ChatSessionManager
  /** Get the WorkerOrchestratorManager instance (optional). */
  getOrchestrator?: (workspaceId?: string) => WorkerOrchestratorManager | null
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

        // ── Orchestrator commands ─────────────────────────────────────

        case "subscribe_orchestrator": {
          client.subscribedToOrchestrator = true
          // Send current orchestrator state
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (orchestrator) {
            ws.send(
              JSON.stringify({
                type: "orchestrator_state",
                state: orchestrator.getState(),
                maxWorkers: orchestrator.getMaxWorkers(),
                activeWorkerCount: orchestrator.getActiveWorkerCount(),
                workers: orchestrator.getWorkerStates(),
                workspaceId: client.workspaceId,
              }),
            )
          }
          break
        }

        case "unsubscribe_orchestrator": {
          client.subscribedToOrchestrator = false
          break
        }

        case "orchestrator_start": {
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator
            .start()
            .then(() => {
              ws.send(
                JSON.stringify({
                  type: "orchestrator_started",
                  state: orchestrator.getState(),
                  workspaceId: client.workspaceId,
                }),
              )
            })
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: "error", error: err.message }))
            })
          break
        }

        case "orchestrator_stop": {
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator
            .stop()
            .then(() => {
              ws.send(
                JSON.stringify({
                  type: "orchestrator_stopped",
                  state: orchestrator.getState(),
                  workspaceId: client.workspaceId,
                }),
              )
            })
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: "error", error: err.message }))
            })
          break
        }

        case "orchestrator_stop_after_current": {
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator.stopAfterCurrent()
          ws.send(
            JSON.stringify({
              type: "orchestrator_stopping",
              state: orchestrator.getState(),
              workspaceId: client.workspaceId,
            }),
          )
          break
        }

        case "orchestrator_cancel_stop": {
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator
            .cancelStopAfterCurrent()
            .then(() => {
              ws.send(
                JSON.stringify({
                  type: "orchestrator_resumed",
                  state: orchestrator.getState(),
                  workspaceId: client.workspaceId,
                }),
              )
            })
            .catch((err: Error) => {
              ws.send(JSON.stringify({ type: "error", error: err.message }))
            })
          break
        }

        case "worker_pause": {
          const workerName = msg.workerName as string
          if (!workerName) {
            ws.send(JSON.stringify({ type: "error", error: "workerName is required" }))
            break
          }
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator.pauseWorker(workerName)
          ws.send(
            JSON.stringify({
              type: "worker_paused",
              workerName,
              state: orchestrator.getWorkerState(workerName),
              workspaceId: client.workspaceId,
            }),
          )
          break
        }

        case "worker_resume": {
          const workerName = msg.workerName as string
          if (!workerName) {
            ws.send(JSON.stringify({ type: "error", error: "workerName is required" }))
            break
          }
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator.resumeWorker(workerName)
          ws.send(
            JSON.stringify({
              type: "worker_resumed",
              workerName,
              state: orchestrator.getWorkerState(workerName),
              workspaceId: client.workspaceId,
            }),
          )
          break
        }

        case "worker_stop": {
          const workerName = msg.workerName as string
          if (!workerName) {
            ws.send(JSON.stringify({ type: "error", error: "workerName is required" }))
            break
          }
          const orchestrator = options.getOrchestrator?.(client.workspaceId)
          if (!orchestrator) {
            ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
            break
          }
          orchestrator.stopWorker(workerName)
          ws.send(
            JSON.stringify({
              type: "worker_stopped",
              workerName,
              reason: "stopped",
              workspaceId: client.workspaceId,
            }),
          )
          break
        }
      }
    } catch {
      // Ignore malformed messages
    }
  })

  // ── Orchestrator event handlers ─────────────────────────────────────

  // Track orchestrator event handlers for cleanup
  const orchestratorHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = []

  // Setup orchestrator event forwarding if available
  const orchestrator = options.getOrchestrator?.(client.workspaceId)
  if (orchestrator) {
    const onWorkerStarted = ({ workerName }: { workerName: string }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "worker_started",
            workerName,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onWorkerStopped = ({
      workerName,
      reason,
    }: {
      workerName: string
      reason: "completed" | "stopped" | "error"
    }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "worker_stopped",
            workerName,
            reason,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onWorkerPaused = ({ workerName }: { workerName: string }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "worker_paused",
            workerName,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onWorkerResumed = ({ workerName }: { workerName: string }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "worker_resumed",
            workerName,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onTaskStarted = ({
      workerName,
      taskId,
      title,
    }: {
      workerName: string
      taskId: string
      title: string
    }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "task_started",
            workerName,
            taskId,
            title,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onTaskCompleted = ({ workerName, taskId }: { workerName: string; taskId: string }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "task_completed",
            workerName,
            taskId,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onStateChanged = ({ state }: { state: string }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "orchestrator_state_changed",
            state,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    const onOrchestratorError = ({ workerName, error }: { workerName?: string; error: Error }) => {
      if (client.subscribedToOrchestrator && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "orchestrator_error",
            workerName,
            error: error.message,
            workspaceId: client.workspaceId,
          }),
        )
      }
    }

    orchestrator.on("worker_started", onWorkerStarted)
    orchestrator.on("worker_stopped", onWorkerStopped)
    orchestrator.on("worker_paused", onWorkerPaused)
    orchestrator.on("worker_resumed", onWorkerResumed)
    orchestrator.on("task_started", onTaskStarted)
    orchestrator.on("task_completed", onTaskCompleted)
    orchestrator.on("state_changed", onStateChanged)
    orchestrator.on("error", onOrchestratorError)

    orchestratorHandlers.push(
      { event: "worker_started", handler: onWorkerStarted as () => void },
      { event: "worker_stopped", handler: onWorkerStopped as () => void },
      { event: "worker_paused", handler: onWorkerPaused as () => void },
      { event: "worker_resumed", handler: onWorkerResumed as () => void },
      { event: "task_started", handler: onTaskStarted as () => void },
      { event: "task_completed", handler: onTaskCompleted as () => void },
      { event: "state_changed", handler: onStateChanged as () => void },
      { event: "error", handler: onOrchestratorError as () => void },
    )
  }

  ws.on("close", () => {
    manager.off("event", onEvent)
    manager.off("status", onStatus)
    manager.off("error", onError)

    // Clean up orchestrator handlers
    if (orchestrator) {
      for (const { event, handler } of orchestratorHandlers) {
        // Use removeListener which accepts less strict types
        ;(
          orchestrator as unknown as { removeListener: (e: string, h: () => void) => void }
        ).removeListener(event, handler)
      }
    }

    clients.delete(client)
  })

  ws.send(JSON.stringify({ type: "connected" }))
}
