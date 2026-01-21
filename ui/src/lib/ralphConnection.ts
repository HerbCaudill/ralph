/**
 * Singleton WebSocket manager for Ralph connection.
 * Lives outside React to survive HMR and StrictMode remounts.
 */

import { useAppStore } from "../store"
import { isRalphStatus } from "../store"

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

/**
 * Reset reconnection state after successful connection
 */
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
    const { type, timestamp } = data as { type?: string; timestamp?: number }

    if (!type) return

    const store = useAppStore.getState()

    switch (type) {
      case "connected":
        // Welcome message - sync Ralph status from server
        if (isRalphStatus(data.ralphStatus)) {
          store.setRalphStatus(data.ralphStatus)
        }
        // Restore event history from server (for page reloads)
        if (Array.isArray(data.events) && data.events.length > 0) {
          store.setEvents(data.events)
        }
        break

      case "ralph:event":
        if (data.event && typeof data.event === "object") {
          const event = data.event as { type: string; timestamp: number; [key: string]: unknown }
          store.addEvent(event)
          // If we're receiving events, Ralph must be running - fix any inconsistent status
          if (store.ralphStatus === "stopped") {
            store.setRalphStatus("running")
          }
          // Extract token usage from stream events
          if (event.type === "stream_event") {
            const streamEvent = (event as any).event
            if (streamEvent?.type === "message_delta" && streamEvent.usage) {
              const usage = streamEvent.usage
              // Calculate total input tokens (including cache tokens which are billed)
              const inputTokens =
                (usage.input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.cache_read_input_tokens || 0)
              const outputTokens = usage.output_tokens || 0
              if (inputTokens > 0 || outputTokens > 0) {
                store.addTokenUsage({ input: inputTokens, output: outputTokens })
                // Update context window usage (total tokens used = input + output)
                const totalTokens =
                  store.tokenUsage.input + inputTokens + store.tokenUsage.output + outputTokens
                store.updateContextWindowUsed(totalTokens)
              }
            }
          }
        }
        break

      case "ralph:status":
        if (isRalphStatus(data.status)) {
          store.setRalphStatus(data.status)
        }
        break

      case "ralph:output":
        store.addEvent({
          type: "output",
          timestamp: timestamp ?? Date.now(),
          line: data.line,
        })
        // If we're receiving output, Ralph must be running - fix any inconsistent status
        if (store.ralphStatus === "stopped") {
          store.setRalphStatus("running")
        }
        break

      case "ralph:error":
        store.addEvent({
          type: "error",
          timestamp: timestamp ?? Date.now(),
          error: data.error,
        })
        break

      case "ralph:exit":
        store.addEvent({
          type: "exit",
          timestamp: timestamp ?? Date.now(),
          code: data.code,
          signal: data.signal,
        })
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

      // Task update events
      case "task:updated":
        // Task was updated (e.g., via auto-titling) - update in store
        if (data.issue && typeof data.issue === "object") {
          const task = data.issue as { id: string; [key: string]: unknown }
          store.updateTask(task.id, task)
        }
        break

      // Task chat events
      case "task-chat:message":
        // Complete assistant message received
        if (data.message && typeof data.message === "object") {
          const msg = data.message as { role: string; content: string; timestamp: number }
          if (msg.role === "assistant") {
            store.addTaskChatMessage({
              id: `assistant-${msg.timestamp || Date.now()}`,
              role: "assistant",
              content: msg.content,
              timestamp: msg.timestamp || Date.now(),
            })
            // Clear streaming text since message is complete
            // Note: Tool uses are NOT cleared here - they stay visible until user sends next message
            store.setTaskChatStreamingText("")
            store.setTaskChatLoading(false)
          }
        }
        break

      case "task-chat:chunk":
        // Streaming text chunk received
        if (typeof data.text === "string") {
          store.appendTaskChatStreamingText(data.text)
        }
        break

      case "task-chat:status":
        // Task chat status change (idle, processing, streaming, error)
        if (typeof data.status === "string") {
          const isProcessing = data.status === "processing" || data.status === "streaming"
          store.setTaskChatLoading(isProcessing)
          // Clear streaming text when idle or error
          if (data.status === "idle" || data.status === "error") {
            store.setTaskChatStreamingText("")
          }
        }
        break

      case "task-chat:error":
        // Task chat error
        store.setTaskChatLoading(false)
        store.setTaskChatStreamingText("")
        if (typeof data.error === "string") {
          store.addTaskChatMessage({
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${data.error}`,
            timestamp: Date.now(),
          })
        }
        break

      case "task-chat:tool_use":
        // Task chat tool use started
        if (data.toolUse && typeof data.toolUse === "object") {
          const toolUse = data.toolUse as {
            toolUseId: string
            tool: string
            input: Record<string, unknown>
            status: "pending" | "running" | "success" | "error"
          }
          store.addTaskChatToolUse(toolUse)
        }
        break

      case "task-chat:tool_update":
        // Task chat tool use updated (e.g., with full input after streaming)
        if (data.toolUse && typeof data.toolUse === "object") {
          const toolUse = data.toolUse as {
            toolUseId: string
            tool: string
            input: Record<string, unknown>
            status: "pending" | "running" | "success" | "error"
          }
          store.updateTaskChatToolUse(toolUse.toolUseId, {
            input: toolUse.input,
            status: toolUse.status,
          })
        }
        break

      case "task-chat:tool_result":
        // Task chat tool result received
        if (data.toolUse && typeof data.toolUse === "object") {
          const toolUse = data.toolUse as {
            toolUseId: string
            tool: string
            input: Record<string, unknown>
            output?: string
            error?: string
            status: "pending" | "running" | "success" | "error"
          }
          store.updateTaskChatToolUse(toolUse.toolUseId, {
            output: toolUse.output,
            error: toolUse.error,
            status: toolUse.status,
          })
        }
        break

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
  }

  ws.onmessage = handleMessage

  ws.onerror = () => {
    // Error handling - close will fire after this
  }

  ws.onclose = () => {
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

      console.log(
        `[ralphConnection] Reconnecting in ${currentReconnectDelay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
      )

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
}

/**
 * Manual reconnection - resets backoff state and attempts to connect immediately.
 * Use this when the user explicitly wants to retry after a failed connection.
 */
function reconnect(): void {
  resetReconnectState()
  connect()
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
