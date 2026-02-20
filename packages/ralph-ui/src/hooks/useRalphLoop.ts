import { useState, useEffect, useRef, useCallback } from "react"
import type { ChatEvent, ControlState, ConnectionStatus } from "@herbcaudill/agent-view"
import type { WorkerMessage, WorkerEvent } from "../workers/ralphWorker"
import {
  saveWorkspaceSession,
  loadWorkspaceSession,
  clearWorkspaceSession,
} from "../lib/workspaceSessionStorage"
import { extractTaskLifecycleEvent } from "../lib/extractTaskLifecycleEvent"
import { normalizeEventId } from "../lib/normalizeEventId"

/**
 * @deprecated Use `useSessionEvents` instead. This hook is kept for backwards compatibility
 * but is no longer used by any components. The localStorage session persistence has been
 * removed since the orchestrator handles session management server-side.
 *
 * Original description:
 * Hook that communicates with the SharedWorker (ralphWorker.ts) for session event subscription.
 * Subscribes to a specific workspace and provides state for events, streaming status,
 * and connection status, along with actions to pause, resume, and send messages.
 *
 * Loop management (start, stop, stop-after-current) is handled by useWorkerOrchestrator.
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

    // Skip global events or events for other workspaces
    if (
      data.type === "stop_after_current_global_change" ||
      !("workspaceId" in data) ||
      data.workspaceId !== currentWorkspaceRef.current
    ) {
      return
    }

    switch (data.type) {
      case "state_change":
        setControlState(data.state)
        // Clear session ID when transitioning to idle (session is complete)
        if (data.state === "idle" && currentWorkspaceRef.current) {
          clearWorkspaceSession(currentWorkspaceRef.current)
        }
        break

      case "event": {
        // Normalize uuid -> id for Claude CLI events
        const event = normalizeEventId(data.event as ChatEvent)
        setEvents(prev => {
          // Deduplicate by event id if present
          if (event.id && prev.some(e => e.id === event.id)) {
            return prev
          }

          // Deduplicate user_message events by content (for optimistic updates)
          if (event.type === "user_message") {
            const msg = (event as ChatEvent & { message?: string }).message
            const alreadyExists = prev.some(
              e =>
                e.type === "user_message" &&
                (e as ChatEvent & { message?: string }).message === msg,
            )
            if (alreadyExists) return prev
          }

          // Check for task lifecycle markers in assistant events
          const lifecycleEvent = extractTaskLifecycleEvent(event)
          if (lifecycleEvent) {
            // Emit both the original event and the derived task_lifecycle event
            return [...prev, event, lifecycleEvent]
          }
          return [...prev, event]
        })
        break
      }

      case "pending_events": {
        // Process each pending event, extracting task lifecycle events as needed
        const pendingEvents = data.events as ChatEvent[]
        setEvents(prev => {
          const existingIds = new Set(prev.filter(e => e.id).map(e => e.id))
          const newEvents: ChatEvent[] = []

          for (const rawEvent of pendingEvents) {
            // Normalize uuid -> id for Claude CLI events
            const event = normalizeEventId(rawEvent)
            // Skip if we already have this event
            if (event.id && existingIds.has(event.id)) continue

            newEvents.push(event)
            existingIds.add(event.id) // Track for duplicates within pending_events

            const lifecycleEvent = extractTaskLifecycleEvent(event)
            if (lifecycleEvent) {
              newEvents.push(lifecycleEvent)
            }
          }

          return [...prev, ...newEvents]
        })
        break
      }

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
        if (currentWorkspaceRef.current) {
          saveWorkspaceSession(currentWorkspaceRef.current, data.sessionId)
        }
        break

      case "session_restored":
        // Session restored from localStorage
        setSessionId(data.sessionId)
        // Re-persist the session ID to localStorage
        if (currentWorkspaceRef.current) {
          saveWorkspaceSession(currentWorkspaceRef.current, data.sessionId)
        }
        // If the session was running or paused before reload, restore that state
        if (data.controlState === "running" || data.controlState === "paused") {
          setControlState(data.controlState)
          if (data.controlState === "running") {
            setIsStreaming(true) // Session is still active
          }
        }
        break

      case "streaming_state":
        // Toggle streaming state based on agent processing status
        setIsStreaming(data.isStreaming)
        break

      // stop_after_current_change is now handled by orchestrator - ignored here
      case "stop_after_current_change":
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
        portRef.current.postMessage({
          type: "restore_session",
          workspaceId,
          sessionId: savedSessionId,
        } satisfies WorkerMessage)
      }
    }, 0)

    return () => {
      clearTimeout(subscribeTimer)
    }
  }, [workspaceId])

  /** Pause/interrupt the Ralph session immediately. */
  const pause = useCallback(() => {
    if (!workspaceId) return
    setIsStreaming(false)
    postMessage({ type: "pause", workspaceId })
  }, [workspaceId, postMessage])

  /** Resume the Ralph session from paused state. */
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

  return {
    events,
    isStreaming,
    controlState,
    connectionStatus,
    sessionId,
    pause,
    resume,
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
  /** Current state of the session (idle, running, or paused). */
  controlState: ControlState
  /** Status of the connection to the SharedWorker. */
  connectionStatus: ConnectionStatus
  /** The current session ID (active or restored from localStorage). */
  sessionId: string | null
  /** Pause/interrupt the Ralph session immediately. */
  pause: () => void
  /** Resume the Ralph session from paused state. */
  resume: () => void
  /** Send a message to Claude within the current session. */
  sendMessage: (message: string) => void
}
