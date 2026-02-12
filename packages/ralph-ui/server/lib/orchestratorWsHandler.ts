import type { WebSocket, RawData } from "ws"
import type { WorkerOrchestratorManager } from "./WorkerOrchestratorManager.js"

/** A connected WebSocket client with orchestrator subscription state. */
export interface OrchestratorWsClient {
  /** The WebSocket connection. */
  ws: WebSocket
  /** Workspace ID this client is associated with. */
  workspaceId?: string
  /** Whether this client is subscribed to orchestrator events. */
  subscribedToOrchestrator?: boolean
}

/** Options for setting up orchestrator WebSocket handling. */
export interface OrchestratorWsHandlerOptions {
  /** Get the WorkerOrchestratorManager instance for a workspace. */
  getOrchestrator: (workspaceId?: string) => WorkerOrchestratorManager | null
}

/**
 * Handle orchestrator-related WebSocket messages.
 * Returns true if the message was an orchestrator command (handled), false otherwise.
 *
 * This allows the caller to compose session and orchestrator WS handling on the same connection.
 */
export function handleOrchestratorWsMessage(
  /** The parsed message. */
  msg: Record<string, unknown>,
  /** The WebSocket connection. */
  ws: WebSocket,
  /** The client state. */
  client: OrchestratorWsClient,
  /** Handler options. */
  options: OrchestratorWsHandlerOptions,
): boolean {
  switch (msg.type) {
    case "subscribe_orchestrator": {
      client.subscribedToOrchestrator = true
      const orchestrator = options.getOrchestrator(client.workspaceId)
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
      return true
    }

    case "unsubscribe_orchestrator": {
      client.subscribedToOrchestrator = false
      return true
    }

    case "orchestrator_start": {
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
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
      return true
    }

    case "orchestrator_stop": {
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
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
      return true
    }

    case "orchestrator_stop_after_current": {
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
      }
      orchestrator.stopAfterCurrent()
      ws.send(
        JSON.stringify({
          type: "orchestrator_stopping",
          state: orchestrator.getState(),
          workspaceId: client.workspaceId,
        }),
      )
      return true
    }

    case "orchestrator_cancel_stop": {
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
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
      return true
    }

    case "worker_pause": {
      const workerName = msg.workerName as string
      if (!workerName) {
        ws.send(JSON.stringify({ type: "error", error: "workerName is required" }))
        return true
      }
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
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
      return true
    }

    case "worker_resume": {
      const workerName = msg.workerName as string
      if (!workerName) {
        ws.send(JSON.stringify({ type: "error", error: "workerName is required" }))
        return true
      }
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
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
      return true
    }

    case "worker_stop": {
      const workerName = msg.workerName as string
      if (!workerName) {
        ws.send(JSON.stringify({ type: "error", error: "workerName is required" }))
        return true
      }
      const orchestrator = options.getOrchestrator(client.workspaceId)
      if (!orchestrator) {
        ws.send(JSON.stringify({ type: "error", error: "Orchestrator not configured" }))
        return true
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
      return true
    }

    default:
      return false
  }
}

/**
 * Set up orchestrator event forwarding for a WebSocket client.
 * Returns a cleanup function that removes all event listeners.
 */
export function setupOrchestratorEventForwarding(
  /** The client to forward events to. */
  client: OrchestratorWsClient,
  /** The orchestrator to listen on. */
  orchestrator: WorkerOrchestratorManager,
): () => void {
  const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = []
  const { ws } = client

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

  const onWorkStarted = ({ workerName, workId }: { workerName: string; workId: string }) => {
    if (client.subscribedToOrchestrator && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "work_started",
          workerName,
          workId,
          workspaceId: client.workspaceId,
        }),
      )
    }
  }

  const onWorkCompleted = ({ workerName, workId }: { workerName: string; workId: string }) => {
    if (client.subscribedToOrchestrator && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "work_completed",
          workerName,
          workId,
          workspaceId: client.workspaceId,
        }),
      )
    }
  }

  const onSessionCreated = ({
    workerName,
    sessionId,
  }: {
    workerName: string
    sessionId: string
  }) => {
    if (client.subscribedToOrchestrator && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: "session_created",
          workerName,
          sessionId,
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
  orchestrator.on("work_started", onWorkStarted)
  orchestrator.on("work_completed", onWorkCompleted)
  orchestrator.on("session_created", onSessionCreated)
  orchestrator.on("state_changed", onStateChanged)
  orchestrator.on("error", onOrchestratorError)

  handlers.push(
    { event: "worker_started", handler: onWorkerStarted as () => void },
    { event: "worker_stopped", handler: onWorkerStopped as () => void },
    { event: "worker_paused", handler: onWorkerPaused as () => void },
    { event: "worker_resumed", handler: onWorkerResumed as () => void },
    { event: "work_started", handler: onWorkStarted as () => void },
    { event: "work_completed", handler: onWorkCompleted as () => void },
    { event: "session_created", handler: onSessionCreated as () => void },
    { event: "state_changed", handler: onStateChanged as () => void },
    { event: "error", handler: onOrchestratorError as () => void },
  )

  /** Remove all event listeners. */
  return () => {
    for (const { event, handler } of handlers) {
      ;(
        orchestrator as unknown as { removeListener: (e: string, h: () => void) => void }
      ).removeListener(event, handler)
    }
  }
}
