/**
 * Singleton WebSocket manager for Ralph connection.
 * Lives outside React to survive HMR and StrictMode remounts.
 */

import { useAppStore, flushTaskChatEventsBatch } from "../store"
import { isRalphStatus, isSessionBoundary } from "../store"
import { checkForSavedSessionState, restoreSessionState } from "./sessionStateApi"
import { extractTokenUsageFromEvent } from "./extractTokenUsage"
import { eventDatabase, type PersistedEvent } from "./persistence"

// Connection status constants and type guard
export const CONNECTION_STATUSES = ["disconnected", "connecting", "connected"] as const
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return typeof value === "string" && CONNECTION_STATUSES.includes(value as ConnectionStatus)
}

interface RalphConnectionManager {
  status: ConnectionStatus
  connect: () => void
  disconnect: () => void
  send: (message: unknown) => void
  reset: () => void // For testing
  reconnect: () => void // Manual reconnect (resets backoff state)
  readonly reconnectAttempts: number
  readonly maxReconnectAttempts: number
}

// Singleton state
let ws: WebSocket | null = null
let status: ConnectionStatus = "disconnected"
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false
let initialized = false

// Reconnection configuration
const INITIAL_RECONNECT_DELAY = 1000 // 1 second
const MAX_RECONNECT_DELAY = 30000 // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10
const JITTER_FACTOR = 0.3 // +/- 30% jitter

// Reconnection state
let reconnectAttempts = 0
let currentReconnectDelay = INITIAL_RECONNECT_DELAY

// Event index tracking for reconnection sync
// Maps instanceId to the last known event index for that instance
const lastEventIndices: Map<string, number> = new Map()

// Session tracking for IndexedDB persistence
// Maps instanceId to the current session ID for that instance
const currentSessionIds: Map<string, string> = new Map()

/**
 * Generate a session ID based on instance ID and timestamp.
 * Format: "{instanceId}-{timestamp}"
 */
function generateSessionId(instanceId: string, timestamp: number): string {
  return `${instanceId}-${timestamp}`
}

/**
 * Persist an event directly to IndexedDB.
 * Uses the server-assigned UUID as the event ID for deduplication.
 */
async function persistEventToIndexedDB(
  event: { type: string; timestamp: number; id?: string; [key: string]: unknown },
  sessionId: string,
): Promise<void> {
  // Use server-assigned UUID if available, otherwise generate one
  const eventId =
    event.id ?? `${sessionId}-event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const persistedEvent: PersistedEvent = {
    id: eventId,
    sessionId,
    timestamp: event.timestamp,
    eventType: event.type ?? "unknown",
    event: event as PersistedEvent["event"],
  }

  try {
    await eventDatabase.saveEvent(persistedEvent)
    console.debug(
      `[ralphConnection] Event persisted to IndexedDB: id=${eventId}, type=${event.type}`,
    )
  } catch (error) {
    console.error("[ralphConnection] Failed to persist event to IndexedDB:", error, {
      eventId,
      sessionId,
      eventType: event.type,
    })
  }
}

/**
 * Calculate the next reconnection delay using exponential backoff with jitter.
 * Jitter helps prevent thundering herd when many clients reconnect simultaneously.
 */
function calculateReconnectDelay(): number {
  // Exponential backoff: delay doubles each attempt
  const baseDelay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY,
  )

  // Add jitter: random value between -30% and +30% of base delay
  const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1)
  return Math.max(INITIAL_RECONNECT_DELAY, Math.round(baseDelay + jitter))
}

/**  Reset reconnection state after successful connection */
function resetReconnectState(): void {
  reconnectAttempts = 0
  currentReconnectDelay = INITIAL_RECONNECT_DELAY
}

function getDefaultUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}/ws`
}

function clearReconnectTimeout(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
}

function setStatus(newStatus: ConnectionStatus): void {
  status = newStatus
  useAppStore.getState().setConnectionStatus(newStatus)
}

function handleMessage(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data)
    const { type, timestamp, instanceId } = data as {
      type?: string
      timestamp?: number
      instanceId?: string
    }

    if (!type) return

    const store = useAppStore.getState()

    // Determine if this message is for a non-active instance
    // Messages with instanceId are routed to that specific instance
    // Messages without instanceId go to the active instance (backward compatibility)
    const targetInstanceId = instanceId ?? store.activeInstanceId
    const isForActiveInstance = targetInstanceId === store.activeInstanceId

    // Task chat messages are only processed for the active instance
    // (since task chat state is not per-instance yet)
    const activeOnlyTypes = [
      "task-chat:event",
      "task-chat:message",
      "task-chat:chunk",
      "task-chat:status",
      "task-chat:error",
      "task-chat:tool_use",
      "task-chat:tool_update",
      "task-chat:tool_result",
    ]

    // Skip task chat messages for non-active instances
    if (activeOnlyTypes.includes(type) && !isForActiveInstance) {
      return
    }

    switch (type) {
      case "connected":
        // Welcome message - sync Ralph status from server
        // Route to correct instance based on instanceId
        if (isRalphStatus(data.ralphStatus)) {
          if (isForActiveInstance) {
            store.setRalphStatus(data.ralphStatus)
          } else {
            store.setStatusForInstance(targetInstanceId, data.ralphStatus)
          }
        }
        // Restore event history from server (for page reloads)
        if (Array.isArray(data.events) && data.events.length > 0) {
          if (isForActiveInstance) {
            store.setEvents(data.events)
          } else {
            store.setEventsForInstance(targetInstanceId, data.events)
          }
        }
        break

      case "instances:list":
        // Hydrate store with full instance list from server
        if (Array.isArray(data.instances)) {
          store.hydrateInstances(data.instances)
        }
        break

      case "pending_events":
        // Response to reconnect message - contains events we missed while disconnected
        {
          const pendingInstanceId = (data.instanceId as string) || "default"
          const pendingEvents = data.events as Array<{
            type: string
            timestamp: number
            [key: string]: unknown
          }>
          const totalEvents = data.totalEvents as number | undefined

          // Update our tracking with the latest event index
          if (typeof totalEvents === "number" && totalEvents > 0) {
            lastEventIndices.set(pendingInstanceId, totalEvents - 1)
          }

          // Sync Ralph status if provided
          if (isRalphStatus(data.ralphStatus)) {
            const isPendingActive = pendingInstanceId === store.activeInstanceId
            if (isPendingActive) {
              store.setRalphStatus(data.ralphStatus)
            } else {
              store.setStatusForInstance(pendingInstanceId, data.ralphStatus)
            }
          }

          // Add missed events to the store and persist to IndexedDB
          if (Array.isArray(pendingEvents) && pendingEvents.length > 0) {
            console.log(
              `[ralphConnection] Processing ${pendingEvents.length} pending events for instance: ${pendingInstanceId}`,
            )
            const isPendingActive = pendingInstanceId === store.activeInstanceId
            for (const event of pendingEvents) {
              // Check for session boundary to update session tracking
              if (isSessionBoundary(event)) {
                const newSessionId = generateSessionId(pendingInstanceId, event.timestamp)
                currentSessionIds.set(pendingInstanceId, newSessionId)
                console.debug(
                  `[ralphConnection] New session from pending event: id=${newSessionId}, instanceId=${pendingInstanceId}`,
                )
              }

              // Persist to IndexedDB (deduplication handled by server UUID)
              const sessionId = currentSessionIds.get(pendingInstanceId)
              if (sessionId) {
                persistEventToIndexedDB(event, sessionId)
              }

              // Update Zustand for UI
              if (isPendingActive) {
                store.addEvent(event)
              } else {
                store.addEventForInstance(pendingInstanceId, event)
              }
            }
          }
        }
        break

      case "workspace_switched":
        // Workspace was switched on the server - sync state from new workspace
        // This happens when switching to a workspace that may already have Ralph running
        // Route to correct instance based on instanceId
        if (isRalphStatus(data.ralphStatus)) {
          if (isForActiveInstance) {
            store.setRalphStatus(data.ralphStatus)
          } else {
            store.setStatusForInstance(targetInstanceId, data.ralphStatus)
          }
        }
        // Replace events with the new workspace's event history
        // (clearWorkspaceData already cleared events, this restores from server)
        if (Array.isArray(data.events)) {
          if (isForActiveInstance) {
            store.setEvents(data.events)
          } else {
            store.setEventsForInstance(targetInstanceId, data.events)
          }
        }
        break

      case "ralph:event":
        if (data.event && typeof data.event === "object") {
          const event = data.event as { type: string; timestamp: number; [key: string]: unknown }

          console.debug(
            `[ralphConnection] ralph:event received: type=${event.type}, subtype=${(event as any).subtype ?? "none"}, isForActiveInstance=${isForActiveInstance}`,
          )

          // Track the event index for reconnection sync
          const eventIndex = data.eventIndex as number | undefined
          if (typeof eventIndex === "number") {
            lastEventIndices.set(targetInstanceId, eventIndex)
          }

          // Reset session stats when a new session starts (before adding the event)
          if (isSessionBoundary(event)) {
            console.debug(`[ralphConnection] Session boundary detected, resetting stats`)
            if (isForActiveInstance) {
              store.resetSessionStats()
            } else {
              store.resetSessionStatsForInstance(targetInstanceId)
            }

            // Generate a new session ID for this instance
            const newSessionId = generateSessionId(targetInstanceId, event.timestamp)
            currentSessionIds.set(targetInstanceId, newSessionId)
            console.debug(
              `[ralphConnection] New session started: id=${newSessionId}, instanceId=${targetInstanceId}`,
            )
          }

          // Persist event to IndexedDB (before updating Zustand for UI)
          const sessionId = currentSessionIds.get(targetInstanceId)
          if (sessionId) {
            // Fire and forget - don't block on IndexedDB write
            persistEventToIndexedDB(event, sessionId)
          } else {
            console.debug(
              `[ralphConnection] No active session for instance ${targetInstanceId}, skipping IndexedDB persistence`,
            )
          }

          // Route event to correct instance (Zustand update for UI rendering)
          if (isForActiveInstance) {
            store.addEvent(event)
            console.debug(
              `[ralphConnection] Event added to store, events.length=${store.events.length}`,
            )
            // If we're receiving events, Ralph must be running - fix any inconsistent status
            if (store.ralphStatus === "stopped") {
              store.setRalphStatus("running")
            }
          } else {
            store.addEventForInstance(targetInstanceId, event)
            // Also fix inconsistent status for non-active instances
            const targetInstance = store.instances.get(targetInstanceId)
            if (targetInstance?.status === "stopped") {
              store.setStatusForInstance(targetInstanceId, "running")
            }
          }

          // Extract and update token usage from events using pure function
          const tokenUsage = extractTokenUsageFromEvent(event)
          if (tokenUsage) {
            if (isForActiveInstance) {
              store.addTokenUsage(tokenUsage)
              // Update context window usage (total tokens used = input + output)
              store.updateContextWindowUsed(store.tokenUsage.input + store.tokenUsage.output)
            } else {
              store.addTokenUsageForInstance(targetInstanceId, tokenUsage)
              // Update context window usage for non-active instance
              const targetInstance = store.instances.get(targetInstanceId)
              if (targetInstance) {
                store.updateContextWindowUsedForInstance(
                  targetInstanceId,
                  targetInstance.tokenUsage.input + targetInstance.tokenUsage.output,
                )
              }
            }
          }
        }
        break

      case "ralph:status":
        if (isRalphStatus(data.status)) {
          if (isForActiveInstance) {
            store.setRalphStatus(data.status)
          } else {
            store.setStatusForInstance(targetInstanceId, data.status)
          }
        }
        break

      case "ralph:output":
        {
          const outputEvent = {
            type: "output" as const,
            timestamp: timestamp ?? Date.now(),
            line: data.line,
          }
          if (isForActiveInstance) {
            store.addEvent(outputEvent)
            // If we're receiving output, Ralph must be running - fix any inconsistent status
            if (store.ralphStatus === "stopped") {
              store.setRalphStatus("running")
            }
          } else {
            store.addEventForInstance(targetInstanceId, outputEvent)
            // Also fix inconsistent status for non-active instances
            const targetInstance = store.instances.get(targetInstanceId)
            if (targetInstance?.status === "stopped") {
              store.setStatusForInstance(targetInstanceId, "running")
            }
          }
        }
        break

      case "ralph:error":
        {
          const errorEvent = {
            type: "error" as const,
            timestamp: timestamp ?? Date.now(),
            error: data.error,
          }
          if (isForActiveInstance) {
            store.addEvent(errorEvent)
          } else {
            store.addEventForInstance(targetInstanceId, errorEvent)
          }
        }
        break

      case "ralph:exit":
        {
          const exitEvent = {
            type: "exit" as const,
            timestamp: timestamp ?? Date.now(),
            code: data.code,
            signal: data.signal,
          }
          if (isForActiveInstance) {
            store.addEvent(exitEvent)
          } else {
            store.addEventForInstance(targetInstanceId, exitEvent)
          }
        }
        break

      case "user_message":
        store.addEvent({
          type: "user_message",
          timestamp: timestamp ?? Date.now(),
          message: data.message,
        })
        break

      case "error":
        store.addEvent({
          type: "server_error",
          timestamp: timestamp ?? Date.now(),
          error: data.error,
        })
        break

      case "pong":
        // Ping response, ignore
        break

      // Instance lifecycle events
      case "instance:merge_conflict":
        // Merge conflict detected or cleared for an instance
        if (targetInstanceId) {
          const conflict = data.conflict as {
            files: string[]
            sourceBranch: string
            timestamp: number
          } | null
          store.setMergeConflictForInstance(targetInstanceId, conflict)
        }
        break

      // Task update events
      case "task:updated":
        // Task was updated (e.g., via auto-titling) - update in store
        if (data.issue && typeof data.issue === "object") {
          const task = data.issue as { id: string; [key: string]: unknown }
          store.updateTask(task.id, task)
        }
        break

      // Task chat events - unified event model
      case "task-chat:event":
        // Raw SDK event for unified event stream
        if (data.event && typeof data.event === "object") {
          // Ensure the event has required properties
          const rawEvent = data.event as {
            type?: string
            timestamp?: number
            [key: string]: unknown
          }
          if (typeof rawEvent.type === "string" && typeof rawEvent.timestamp === "number") {
            store.addTaskChatEvent(data.event)

            // Create a properly typed event for token extraction
            const typedEvent = { ...rawEvent, type: rawEvent.type, timestamp: rawEvent.timestamp }

            // Extract and update token usage from task chat events using pure function
            const tokenUsage = extractTokenUsageFromEvent(typedEvent)
            if (tokenUsage) {
              store.addTokenUsage(tokenUsage)
              // Update context window usage (total tokens used = input + output)
              store.updateContextWindowUsed(store.tokenUsage.input + store.tokenUsage.output)
            }
          }
        }
        break

      // Task chat status/error handlers (still needed for loading state)
      case "task-chat:status":
        // Task chat status change (idle, processing, streaming, error)
        if (typeof data.status === "string") {
          const isProcessing = data.status === "processing" || data.status === "streaming"
          store.setTaskChatLoading(isProcessing)

          // When transitioning to idle, ensure all events are flushed immediately
          // so the final response is visible without waiting for the batch timeout
          if (data.status === "idle") {
            flushTaskChatEventsBatch()
          }
        }
        break

      case "task-chat:error":
        // Task chat error
        store.setTaskChatLoading(false)
        if (typeof data.error === "string") {
          store.addTaskChatMessage({
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${data.error}`,
            timestamp: Date.now(),
          })
        }
        break

      // Deprecated legacy handlers - these message types are still emitted by server
      // but we now get content from task-chat:event instead. Ignore them silently.
      case "task-chat:message":
      case "task-chat:chunk":
      case "task-chat:tool_use":
      case "task-chat:tool_update":
      case "task-chat:tool_result":
        // No longer needed - content comes through task-chat:event
        break

      // Mutation events from beads daemon - refresh task list on any task mutation
      case "mutation:event": {
        // Mutation event contains: Type (create/update/delete/status/etc), IssueID, Title, etc.
        // Apply optimistic updates for status changes to provide instant UI feedback
        const mutationEvent = data.event as {
          Type: string
          IssueID: string
          new_status?: "open" | "in_progress" | "blocked" | "deferred" | "closed"
          Title?: string
        }

        if (mutationEvent.Type === "status" && mutationEvent.new_status && mutationEvent.IssueID) {
          // Optimistically update the task status in the store for instant UI feedback
          store.updateTask(mutationEvent.IssueID, { status: mutationEvent.new_status })
        } else if (mutationEvent.Type === "delete" && mutationEvent.IssueID) {
          // Optimistically remove deleted tasks
          store.removeTask(mutationEvent.IssueID)
        }

        // Always refresh the full task list to ensure computed fields (blocked_by, etc.) are correct
        // The debounced refresh will coalesce rapid mutations into a single API call
        store.refreshTasks()
        break
      }

      default:
        console.log("[ralphConnection] unknown message type:", type)
    }
  } catch {
    // If JSON parsing fails, ignore
  }
}

function connect(): void {
  // Don't connect if already connecting or connected
  if (ws?.readyState === WebSocket.CONNECTING || ws?.readyState === WebSocket.OPEN) {
    return
  }

  clearReconnectTimeout()
  intentionalClose = false

  const url = getDefaultUrl()
  setStatus("connecting")

  ws = new WebSocket(url)

  ws.onopen = () => {
    setStatus("connected")
    resetReconnectState() // Reset backoff on successful connection

    const store = useAppStore.getState()
    const instanceId = store.activeInstanceId

    // Send reconnect message if we have a previous event index
    // This allows the server to send us any events we missed while disconnected
    const lastEventIndex = lastEventIndices.get(instanceId)
    if (typeof lastEventIndex === "number") {
      console.log(
        `[ralphConnection] Reconnecting with lastEventIndex: ${lastEventIndex} for instance: ${instanceId}`,
      )
      send({
        type: "reconnect",
        instanceId,
        lastEventIndex,
      })
    }

    // Auto-resume session if Ralph was running before disconnect or has saved state
    // This happens in two cases:
    // 1. We reconnect after losing connection while Ralph was running (in-memory state)
    // 2. We have saved session state on the server (survives page reloads)
    if (store.wasRunningBeforeDisconnect) {
      // In-memory state says Ralph was running - auto-resume immediately
      console.log("[ralphConnection] Auto-resuming: Ralph was running before disconnect")
      restoreSessionState(store.activeInstanceId).then(result => {
        if (!result.ok) {
          console.warn("[ralphConnection] Failed to restore session state:", result.error)
        }
        // Clear the flag regardless of success
        store.clearRunningBeforeDisconnect()
      })
    } else {
      // Check server for saved session state (handles page reload case)
      checkForSavedSessionState().then(savedState => {
        if (savedState) {
          // Found recent saved state on server - auto-resume
          console.log(
            `[ralphConnection] Auto-resuming: found saved state from ${new Date(savedState.savedAt).toLocaleTimeString()}`,
          )
          restoreSessionState(useAppStore.getState().activeInstanceId).then(result => {
            if (!result.ok) {
              console.warn("[ralphConnection] Failed to restore session state:", result.error)
            }
          })
        }
      })
    }
  }

  ws.onmessage = handleMessage

  ws.onerror = () => {
    // Error handling - close will fire after this
  }

  ws.onclose = () => {
    // Before setting status to disconnected, mark if Ralph was running
    // This is used to auto-resume when we reconnect
    useAppStore.getState().markRunningBeforeDisconnect()

    setStatus("disconnected")

    // Schedule reconnection if not intentionally closed
    if (!intentionalClose) {
      // Check if we've exceeded max retry attempts
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(
          `[ralphConnection] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Connection permanently failed.`,
        )
        // Emit a connection error event so the UI can show a permanent error state
        useAppStore.getState().addEvent({
          type: "connection_error",
          timestamp: Date.now(),
          error: `Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts. Please refresh the page to try again.`,
          permanent: true,
        })
        return
      }

      clearReconnectTimeout()
      currentReconnectDelay = calculateReconnectDelay()
      reconnectAttempts++

      // Only log in non-test environments
      if (!(globalThis as Record<string, unknown>).__vitest_worker__) {
        console.log(
          `[ralphConnection] Reconnecting in ${currentReconnectDelay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
        )
      }

      reconnectTimeout = setTimeout(() => {
        connect()
      }, currentReconnectDelay)
    }
  }
}

function disconnect(): void {
  clearReconnectTimeout()
  intentionalClose = true

  if (ws) {
    ws.close()
    ws = null
  }

  setStatus("disconnected")
}

function send(message: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    const payload = typeof message === "string" ? message : JSON.stringify(message)
    ws.send(payload)
  }
}

function reset(): void {
  // For testing - reset all singleton state
  clearReconnectTimeout()
  intentionalClose = true
  if (ws) {
    ws.close()
    ws = null
  }
  status = "disconnected"
  initialized = false
  intentionalClose = false
  resetReconnectState()
  lastEventIndices.clear()
  currentSessionIds.clear()
}

/**
 * Manual reconnection - resets backoff state and attempts to connect immediately.
 * Use this when the user explicitly wants to retry after a failed connection.
 */
function reconnect(): void {
  resetReconnectState()
  connect()
}

/**
 * Get the last known event index for an instance.
 * Used for testing and debugging.
 */
export function getLastEventIndex(instanceId: string): number | undefined {
  return lastEventIndices.get(instanceId)
}

/**
 * Clear event indices for all instances.
 * Called when switching workspaces to start fresh.
 */
export function clearEventIndices(): void {
  lastEventIndices.clear()
  currentSessionIds.clear()
}

/**
 * Get the current session ID for an instance.
 * Used for coordination with persistence hooks and testing.
 */
export function getCurrentSessionId(instanceId: string): string | undefined {
  return currentSessionIds.get(instanceId)
}

/**
 * Set the current session ID for an instance.
 * Used when restoring session state on reconnection/reload.
 */
export function setCurrentSessionId(instanceId: string, sessionId: string): void {
  currentSessionIds.set(instanceId, sessionId)
}

// Export singleton manager
export const ralphConnection: RalphConnectionManager = {
  get status() {
    return status
  },
  get reconnectAttempts() {
    return reconnectAttempts
  },
  get maxReconnectAttempts() {
    return MAX_RECONNECT_ATTEMPTS
  },
  connect,
  disconnect,
  send,
  reset,
  reconnect,
}

// Auto-connect on module load (survives HMR)
export function initRalphConnection(): void {
  if (initialized) return
  initialized = true
  connect()
}

// For HMR: preserve connection across hot reloads
if (import.meta.hot) {
  // Preserve the WebSocket connection during HMR
  import.meta.hot.accept()

  // Don't dispose - we want to keep the connection alive
  import.meta.hot.dispose(() => {
    // Do nothing - preserve connection
  })
}
