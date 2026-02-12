import { useState, useEffect, useRef, useCallback } from "react"
import type { ChatEvent, ConnectionStatus } from "@herbcaudill/agent-view"
import type { WorkerMessage, WorkerEvent } from "../workers/ralphWorker"
import { extractTaskLifecycleEvent } from "../lib/extractTaskLifecycleEvent"
import { normalizeEventId } from "../lib/normalizeEventId"

/**
 * Hook that subscribes to a session's events via the SharedWorker.
 *
 * This is a simplified hook that ONLY handles event subscription and deduplication.
 * It does NOT manage:
 * - Loop control (start/pause/resume) - use useWorkerOrchestrator for that
 * - Session creation/continuation - the orchestrator handles that server-side
 * - Marker detection for auto-continuation - removed since orchestrator handles loops
 *
 * The SharedWorker maintains WebSocket connection pooling across browser tabs.
 */
export function useSessionEvents(
  /** Workspace identifier in `owner/repo` format. */
  workspaceId?: string,
  /** Optional session ID to subscribe to. If not provided, subscribes to the workspace's current session. */
  sessionId?: string | null,
): UseSessionEventsReturn {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const portRef = useRef<MessagePort | null>(null)
  const currentWorkspaceRef = useRef<string | undefined>(undefined)
  const currentSessionIdRef = useRef<string | null | undefined>(undefined)

  /** Send a message to the SharedWorker. */
  const postMessage = useCallback((message: WorkerMessage) => {
    if (portRef.current) {
      portRef.current.postMessage(message)
    }
  }, [])

  /**
   * Send a message to the agent within the current session.
   * This allows the user to send follow-up messages to the agent.
   */
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

  /**
   * Pause/interrupt the current session.
   * Note: This is a per-session pause, distinct from orchestrator stop.
   */
  const pause = useCallback(() => {
    if (!workspaceId) return
    setIsStreaming(false)
    postMessage({ type: "pause", workspaceId })
  }, [workspaceId, postMessage])

  /**
   * Resume the current session from paused state.
   */
  const resume = useCallback(() => {
    if (!workspaceId) return
    postMessage({ type: "resume", workspaceId })
  }, [workspaceId, postMessage])

  /** Handle messages received from the SharedWorker. */
  const handleWorkerMessage = useCallback((e: MessageEvent<WorkerEvent>) => {
    const data = e.data

    // Skip global events that don't have a workspaceId
    if (
      data.type === "stop_after_current_global_change" ||
      !("workspaceId" in data) ||
      data.workspaceId !== currentWorkspaceRef.current
    ) {
      return
    }

    switch (data.type) {
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
        setActiveSessionId(data.sessionId)
        setIsStreaming(true)
        break

      case "session_restored":
        // Session restored (e.g., after page reload)
        setActiveSessionId(data.sessionId)
        break

      case "streaming_state":
        // Toggle streaming state based on agent processing status
        setIsStreaming(data.isStreaming)
        break

      case "state_change":
        // Clear events when transitioning to idle (session complete)
        if (data.state === "idle") {
          // Only clear if we're subscribed to the live session, not viewing historical
          // The orchestrator may have moved to next task
        }
        break

      case "error":
        console.error("[useSessionEvents] Worker error:", data.error)
        break
    }
  }, [])

  /** Initialize the SharedWorker connection (once). */
  useEffect(() => {
    // SharedWorker is not supported in all environments (e.g., SSR, some browsers)
    if (typeof SharedWorker === "undefined") {
      console.warn("[useSessionEvents] SharedWorker not supported in this environment")
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
        console.error("[useSessionEvents] Worker message error:", e)
      }

      // Start the port to receive messages
      worker.port.start()
    } catch (error) {
      console.error("[useSessionEvents] Failed to create SharedWorker:", error)
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

  /**
   * Subscribe/unsubscribe when workspace or sessionId changes.
   * Subscription deferred with setTimeout(0) so React StrictMode's synchronous
   * mount->unmount->remount cycle doesn't create a SharedWorker WebSocket
   * that is immediately torn down.
   */
  useEffect(() => {
    const previousWorkspaceId = currentWorkspaceRef.current
    currentWorkspaceRef.current = workspaceId
    currentSessionIdRef.current = sessionId

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
      setConnectionStatus("disconnected")
      setActiveSessionId(null)
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

      // If a specific session ID was provided, restore that session
      if (sessionId) {
        portRef.current.postMessage({
          type: "restore_session",
          workspaceId,
          sessionId,
        } satisfies WorkerMessage)
      }
    }, 0)

    return () => {
      clearTimeout(subscribeTimer)
    }
  }, [workspaceId, sessionId])

  /** Clear events (e.g., when switching to a new session). */
  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  return {
    events,
    isStreaming,
    connectionStatus,
    sessionId: activeSessionId,
    sendMessage,
    pause,
    resume,
    clearEvents,
  }
}

/** Return type of the useSessionEvents hook. */
export interface UseSessionEventsReturn {
  /** List of chat events from the session. */
  events: ChatEvent[]
  /** Whether the agent is currently streaming a response. */
  isStreaming: boolean
  /** Status of the connection to the agent server. */
  connectionStatus: ConnectionStatus
  /** The current session ID (active or restored). */
  sessionId: string | null
  /** Send a message to the agent within the current session. */
  sendMessage: (message: string) => void
  /** Pause/interrupt the current session. */
  pause: () => void
  /** Resume the current session from paused state. */
  resume: () => void
  /** Clear all events (e.g., when switching sessions). */
  clearEvents: () => void
}
