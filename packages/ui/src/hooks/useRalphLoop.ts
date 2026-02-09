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
  const [isStoppingAfterCurrent, setIsStoppingAfterCurrent] = useState(false)

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

      case "event": {
        const event = data.event as ChatEvent
        // Deduplicate user_message events — the optimistic update in sendMessage
        // already added the message locally, so skip the server echo
        if (event.type === "user_message") {
          setEvents(prev => {
            const msg = (event as ChatEvent & { message?: string }).message
            const alreadyExists = prev.some(
              e =>
                e.type === "user_message" &&
                (e as ChatEvent & { message?: string }).message === msg,
            )
            return alreadyExists ? prev : [...prev, event]
          })
        } else {
          setEvents(prev => [...prev, event])
        }
        break
      }

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
        // New session — clear old events, start streaming
        setEvents([])
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
          if (data.controlState === "running") {
            setIsStreaming(true) // Session is still active
          }
          // Re-persist to localStorage to fix race condition where state_change:'idle'
          // from subscribe_workspace cleared the saved state before session_restored arrived
          saveWorkspaceState(data.workspaceId, data.controlState)
        }
        break

      case "streaming_state":
        // Toggle streaming state based on agent processing status
        setIsStreaming(data.isStreaming)
        break

      case "stop_after_current_change":
        setIsStoppingAfterCurrent(data.isStoppingAfterCurrent)
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

  /** Pause/interrupt the Ralph loop immediately. */
  const pause = useCallback(() => {
    if (!workspaceId) return
    setIsStreaming(false)
    postMessage({ type: "pause", workspaceId })
  }, [workspaceId, postMessage])

  /** Resume the Ralph loop from paused state. */
  const resume = useCallback(() => {
    if (!workspaceId) return
    postMessage({ type: "resume", workspaceId })
  }, [workspaceId, postMessage])

  /** Send a message to Claude within the current session. */
  const sendMessage = useCallback(
    (message: string) => {
      if (!workspaceId || !message.trim()) return
      const trimmed = message.trim()

      // Optimistic update: show the user message immediately in the event stream
      const userEvent: ChatEvent = {
        type: "user_message",
        message: trimmed,
        timestamp: Date.now(),
      }
      setEvents(prev => [...prev, userEvent])

      postMessage({ type: "message", workspaceId, text: trimmed })
    },
    [workspaceId, postMessage],
  )

  /** Stop after the current session completes. */
  const stopAfterCurrent = useCallback(() => {
    if (!workspaceId) return
    postMessage({ type: "stop_after_current", workspaceId })
  }, [workspaceId, postMessage])

  /** Cancel the pending stop-after-current request. */
  const cancelStopAfterCurrent = useCallback(() => {
    if (!workspaceId) return
    postMessage({ type: "cancel_stop_after_current", workspaceId })
  }, [workspaceId, postMessage])

  return {
    events,
    isStreaming,
    controlState,
    connectionStatus,
    sessionId,
    isStoppingAfterCurrent,
    start,
    pause,
    resume,
    sendMessage,
    stopAfterCurrent,
    cancelStopAfterCurrent,
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
  /** Current state of the Ralph loop (idle, running, or paused). */
  controlState: ControlState
  /** Status of the connection to the SharedWorker. */
  connectionStatus: ConnectionStatus
  /** The current session ID (active or restored from localStorage). */
  sessionId: string | null
  /** Whether the loop is pending stop after the current session completes. */
  isStoppingAfterCurrent: boolean
  /** Start the Ralph loop. */
  start: () => void
  /** Pause/interrupt the Ralph loop immediately. */
  pause: () => void
  /** Resume the Ralph loop from paused state. */
  resume: () => void
  /** Send a message to Claude within the current session. */
  sendMessage: (message: string) => void
  /** Stop after the current session completes. */
  stopAfterCurrent: () => void
  /** Cancel the pending stop-after-current request. */
  cancelStopAfterCurrent: () => void
}
