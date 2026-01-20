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
}

// Singleton state
let ws: WebSocket | null = null
let status: ConnectionStatus = "disconnected"
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false
let initialized = false

const RECONNECT_DELAY = 1000

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
  }

  ws.onmessage = handleMessage

  ws.onerror = () => {
    // Error handling - close will fire after this
  }

  ws.onclose = () => {
    setStatus("disconnected")

    // Schedule reconnection if not intentionally closed
    if (!intentionalClose) {
      clearReconnectTimeout()
      reconnectTimeout = setTimeout(() => {
        connect()
      }, RECONNECT_DELAY)
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
}

// Export singleton manager
export const ralphConnection: RalphConnectionManager = {
  get status() {
    return status
  },
  connect,
  disconnect,
  send,
  reset,
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
