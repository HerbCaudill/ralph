import { useState, useEffect, useRef, useCallback } from "react"
import type { ChatEvent, ControlState, ConnectionStatus } from "@herbcaudill/agent-view"
import type { WorkerMessage, WorkerEvent } from "../workers/ralphWorker"
import {
  saveWorkspaceSession,
  loadWorkspaceSession,
  saveWorkspaceState,
  loadWorkspaceState,
} from "../lib/workspaceSessionStorage"

/**
 * Hook that communicates with the SharedWorker (ralphWorker.ts) to control the Ralph loop.
 * Subscribes to a specific workspace and provides state for events, streaming status,
 * control state, and connection status, along with actions to start, pause, resume, stop,
 * and send messages.
 *
 * Persists the most recent session ID per workspace in localStorage. On page reload,
 * restores the last session for the current workspace so past events can be viewed,
 * without auto-starting a new Ralph run.
 */
export function useRalphLoop(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId?: string,
): UseRalphLoopReturn {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [controlState, setControlState] = useState<ControlState>("idle")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [sessionId, setSessionId] = useState<string | null>(null)

  const portRef = useRef<MessagePort | null>(null)
  const currentWorkspaceRef = useRef<string | undefined>(undefined)

  /** Send a message to the SharedWorker, automatically including the workspaceId. */
  const postMessage = useCallback((message: WorkerMessage) => {
    if (portRef.current) {
      portRef.current.postMessage(message)
    }
  }, [])

  /** Handle messages received from the SharedWorker. */
  const handleWorkerMessage = useCallback((e: MessageEvent<WorkerEvent>) => {
    const data = e.data

    // Only process events for our current workspace
    if (data.workspaceId !== currentWorkspaceRef.current) return

    switch (data.type) {
      case "state_change":
        setControlState(data.state)
        // Persist control state to localStorage so it survives page reloads
        saveWorkspaceState(data.workspaceId, data.state)
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
        setSessionId(data.sessionId)
        setIsStreaming(true)
        // Persist the session ID so it can be restored on page reload
        saveWorkspaceSession(data.workspaceId, data.sessionId)
        break

      case "session_restored":
        // Session restored from localStorage
        setSessionId(data.sessionId)
        // If the session was running or paused before reload, restore that state
        if (data.controlState === "running" || data.controlState === "paused") {
          setControlState(data.controlState)
          setIsStreaming(true) // Session is still active
        }
        break

      case "error":
        console.error("[useRalphLoop] Worker error:", data.error)
        break
    }
  }, [])

  /** Initialize the SharedWorker connection (once). */
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

      portRef.current = worker.port

      worker.port.onmessage = handleWorkerMessage
      worker.port.onmessageerror = e => {
        console.error("[useRalphLoop] Worker message error:", e)
      }

      // Start the port to receive messages
      worker.port.start()
    } catch (error) {
      console.error("[useRalphLoop] Failed to create SharedWorker:", error)
    }

    return () => {
      // Unsubscribe from current workspace before closing the port
      if (portRef.current && currentWorkspaceRef.current) {
        portRef.current.postMessage({
          type: "unsubscribe_workspace",
          workspaceId: currentWorkspaceRef.current,
        } satisfies WorkerMessage)
      }
      if (portRef.current) {
        portRef.current.close()
        portRef.current = null
      }
    }
  }, [handleWorkerMessage])

  /** Subscribe/unsubscribe when workspace changes.
   * Subscription deferred with setTimeout(0) so React StrictMode's synchronous
   * mount→unmount→remount cycle doesn't create a SharedWorker WebSocket
   * that is immediately torn down — which causes ECONNRESET on the proxy.
   */
  useEffect(() => {
    const previousWorkspaceId = currentWorkspaceRef.current
    currentWorkspaceRef.current = workspaceId

    if (!portRef.current) return

    // Unsubscribe from the previous workspace (immediate — no deferral needed)
    if (previousWorkspaceId && previousWorkspaceId !== workspaceId) {
      portRef.current.postMessage({
        type: "unsubscribe_workspace",
        workspaceId: previousWorkspaceId,
      } satisfies WorkerMessage)

      // Reset state for the new workspace
      setEvents([])
      setIsStreaming(false)
      setControlState("idle")
      setConnectionStatus("disconnected")
      setSessionId(null)
    }

    // Subscribe to the new workspace
    if (!workspaceId) return

    const subscribeTimer = setTimeout(() => {
      if (!portRef.current) return

      portRef.current.postMessage({
        type: "subscribe_workspace",
        workspaceId,
      } satisfies WorkerMessage)

      setConnectionStatus("connecting")

      // Attempt to restore a previously saved session from localStorage
      const savedSessionId = loadWorkspaceSession(workspaceId)
      if (savedSessionId) {
        const savedControlState = loadWorkspaceState(workspaceId)
        portRef.current.postMessage({
          type: "restore_session",
          workspaceId,
          sessionId: savedSessionId,
          controlState: savedControlState ?? undefined,
        } satisfies WorkerMessage)
      }
    }, 0)

    return () => {
      clearTimeout(subscribeTimer)
    }
  }, [workspaceId])

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
    sessionId,
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
  /** The current session ID (active or restored from localStorage). */
  sessionId: string | null
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
