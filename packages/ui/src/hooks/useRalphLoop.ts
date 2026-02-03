import { useState, useEffect, useRef, useCallback } from "react"
import type { ChatEvent, ControlState, ConnectionStatus } from "@herbcaudill/agent-view"

/**
 * Hook that communicates with the SharedWorker (ralphWorker.ts) to control the Ralph loop.
 * Provides state for events, streaming status, control state, and connection status,
 * along with actions to start, pause, resume, stop, and send messages.
 */
export function useRalphLoop(): UseRalphLoopReturn {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [controlState, setControlState] = useState<ControlState>("idle")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")

  const workerRef = useRef<SharedWorker | null>(null)
  const portRef = useRef<MessagePort | null>(null)

  /** Send a message to the SharedWorker. */
  const postMessage = useCallback((message: WorkerMessage) => {
    if (portRef.current) {
      portRef.current.postMessage(message)
    }
  }, [])

  /** Handle messages received from the SharedWorker. */
  const handleWorkerMessage = useCallback((e: MessageEvent<WorkerResponse>) => {
    const data = e.data

    switch (data.type) {
      case "events":
        setEvents(data.events)
        break

      case "event":
        setEvents(prev => [...prev, data.event])
        break

      case "streaming":
        setIsStreaming(data.isStreaming)
        break

      case "control_state":
        setControlState(data.state)
        break

      case "connection_status":
        setConnectionStatus(data.status)
        break

      case "error":
        console.error("[useRalphLoop] Worker error:", data.error)
        break
    }
  }, [])

  /** Initialize connection to the SharedWorker. */
  useEffect(() => {
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

      workerRef.current = worker
      portRef.current = worker.port

      worker.port.onmessage = handleWorkerMessage
      worker.port.onmessageerror = e => {
        console.error("[useRalphLoop] Worker message error:", e)
      }

      // Start the port to receive messages
      worker.port.start()

      // Notify the worker that this client has connected
      worker.port.postMessage({ type: "connect" })

      setConnectionStatus("connecting")
    } catch (error) {
      console.error("[useRalphLoop] Failed to create SharedWorker:", error)
      setConnectionStatus("disconnected")
    }

    return () => {
      if (portRef.current) {
        portRef.current.postMessage({ type: "disconnect" })
        portRef.current.close()
        portRef.current = null
      }
      workerRef.current = null
    }
  }, [handleWorkerMessage])

  /** Start the Ralph loop. */
  const start = useCallback(() => {
    postMessage({ type: "start" })
  }, [postMessage])

  /** Pause the Ralph loop. */
  const pause = useCallback(() => {
    postMessage({ type: "pause" })
  }, [postMessage])

  /** Resume the Ralph loop after pausing. */
  const resume = useCallback(() => {
    postMessage({ type: "resume" })
  }, [postMessage])

  /** Stop the Ralph loop. */
  const stop = useCallback(() => {
    postMessage({ type: "stop" })
  }, [postMessage])

  /** Send a message to Claude within the current session. */
  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return
      postMessage({ type: "message", text: message.trim() })
    },
    [postMessage],
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

/** Messages sent to the SharedWorker. */
export type WorkerMessage =
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "message"; text: string }

/** Responses received from the SharedWorker. */
export type WorkerResponse =
  | { type: "events"; events: ChatEvent[] }
  | { type: "event"; event: ChatEvent }
  | { type: "streaming"; isStreaming: boolean }
  | { type: "control_state"; state: ControlState }
  | { type: "connection_status"; status: ConnectionStatus }
  | { type: "error"; error: string }
