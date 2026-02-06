import { useState, useEffect, useRef, useCallback } from "react"
import type { ChatEvent, ControlState, ConnectionStatus } from "@herbcaudill/agent-view"
import type { WorkerMessage, WorkerEvent } from "../workers/ralphWorker"

/**
 * Hook that communicates with the SharedWorker (ralphWorker.ts) to control the Ralph loop.
 * Subscribes to a specific workspace and provides state for events, streaming status,
 * control state, and connection status, along with actions to start, pause, resume, stop,
 * and send messages.
 */
export function useRalphLoop(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId?: string,
): UseRalphLoopReturn {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [controlState, setControlState] = useState<ControlState>("idle")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")

  const portRef = useRef<MessagePort | null>(null)

  /** Send a message to the SharedWorker, automatically including the workspaceId. */
  const postMessage = useCallback((message: WorkerMessage) => {
    if (portRef.current) {
      portRef.current.postMessage(message)
    }
  }, [])

  /** Handle messages received from the SharedWorker. */
  const handleWorkerMessage = useCallback(
    (e: MessageEvent<WorkerEvent>) => {
      const data = e.data

      // Only process events for our workspace
      if (data.workspaceId !== workspaceId) return

      switch (data.type) {
        case "state_change":
          setControlState(data.state)
          break

        case "event":
          setEvents(prev => [...prev, data.event as ChatEvent])
          break

        case "pending_events":
          setEvents(prev => [...prev, ...(data.events as ChatEvent[])])
          break

        case "connected":
          setConnectionStatus("connected")
          break

        case "disconnected":
          setConnectionStatus("disconnected")
          break

        case "session_created":
          // Session created — streaming will follow
          setIsStreaming(true)
          break

        case "error":
          console.error("[useRalphLoop] Worker error:", data.error)
          break
      }
    },
    [workspaceId],
  )

  /** Initialize connection to the SharedWorker and subscribe to the workspace. */
  useEffect(() => {
    if (!workspaceId) return

    // SharedWorker is not supported in all environments (e.g., SSR, some browsers)
    if (typeof SharedWorker === "undefined") {
      console.warn("[useRalphLoop] SharedWorker not supported in this environment")
      return
    }

    try {
      const worker = new SharedWorker(new URL("../workers/ralphWorker.ts", import.meta.url), {
        type: "module",
        name: "ralph-loop-worker",
      })

      portRef.current = worker.port

      worker.port.onmessage = handleWorkerMessage
      worker.port.onmessageerror = e => {
        console.error("[useRalphLoop] Worker message error:", e)
      }

      // Start the port to receive messages
      worker.port.start()

      // Subscribe to workspace events
      worker.port.postMessage({
        type: "subscribe_workspace",
        workspaceId,
      } satisfies WorkerMessage)

      setConnectionStatus("connecting")
    } catch (error) {
      console.error("[useRalphLoop] Failed to create SharedWorker:", error)
      setConnectionStatus("disconnected")
    }

    return () => {
      if (portRef.current) {
        portRef.current.close()
        portRef.current = null
      }
    }
  }, [workspaceId, handleWorkerMessage])

  /** Start the Ralph loop. */
  const start = useCallback(() => {
    if (!workspaceId) return
    setEvents([])
    postMessage({ type: "start", workspaceId })
  }, [workspaceId, postMessage])

  /** Pause the Ralph loop. */
  const pause = useCallback(() => {
    if (!workspaceId) return
    postMessage({ type: "pause", workspaceId })
  }, [workspaceId, postMessage])

  /** Resume the Ralph loop after pausing. */
  const resume = useCallback(() => {
    if (!workspaceId) return
    postMessage({ type: "resume", workspaceId })
  }, [workspaceId, postMessage])

  /** Stop the Ralph loop. */
  const stop = useCallback(() => {
    if (!workspaceId) return
    setIsStreaming(false)
    postMessage({ type: "stop", workspaceId })
  }, [workspaceId, postMessage])

  /** Send a message to Claude within the current session. */
  const sendMessage = useCallback(
    (message: string) => {
      if (!workspaceId || !message.trim()) return
      postMessage({ type: "message", workspaceId, text: message.trim() })
    },
    [workspaceId, postMessage],
  )

  return {
    events,
    isStreaming,
    controlState,
    connectionStatus,
    start,
    pause,
    resume,
    stop,
    sendMessage,
  }
}

// Re-export types from agent-view for convenience
export type { ControlState, ConnectionStatus }

/** Return type of the useRalphLoop hook. */
export interface UseRalphLoopReturn {
  /** List of chat events from the Ralph session. */
  events: ChatEvent[]
  /** Whether the agent is currently streaming a response. */
  isStreaming: boolean
  /** Current state of the Ralph loop (stopped, running, paused). */
  controlState: ControlState
  /** Status of the connection to the SharedWorker. */
  connectionStatus: ConnectionStatus
  /** Start the Ralph loop. */
  start: () => void
  /** Pause the Ralph loop. */
  pause: () => void
  /** Resume the Ralph loop after pausing. */
  resume: () => void
  /** Stop the Ralph loop. */
  stop: () => void
  /** Send a message to Claude within the current session. */
  sendMessage: (message: string) => void
}
