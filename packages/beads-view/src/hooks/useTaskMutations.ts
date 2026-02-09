import { useEffect, useRef, useState, useCallback } from "react"
import { buildWsUrl } from "../lib/buildWsUrl"
import { getApiClientConfig } from "../lib/apiClient"
import { beadsViewStore } from "../store"

/** Initial reconnection delay in ms. */
const INITIAL_RECONNECT_DELAY = 1000

/** Maximum reconnection delay in ms (30 seconds). */
const MAX_RECONNECT_DELAY = 30000

/** Backoff multiplier for exponential backoff. */
const BACKOFF_MULTIPLIER = 2

/**
 * Mutation event from beads-server WebSocket.
 */
export interface MutationEventMessage {
  type: "mutation:event"
  event: {
    type: string
    issueId?: string
    [key: string]: unknown
  }
  workspace: string
  timestamp: number
}

/**
 * Options for useTaskMutations hook.
 */
export interface UseTaskMutationsOptions {
  /** Enable/disable the WebSocket connection. Defaults to true. */
  enabled?: boolean
  /** Workspace path to subscribe to. Defaults to configured workspacePath from apiClient. */
  workspacePath?: string
  /** Callback invoked on mutation events. */
  onMutation?: (event: MutationEventMessage["event"]) => void
}

/**
 * Result from useTaskMutations hook.
 */
export interface UseTaskMutationsResult {
  /** Whether the WebSocket is currently connected. */
  isConnected: boolean
}

/**
 * Hook that connects to beads-server WebSocket and refreshes tasks on mutation events.
 *
 * Features:
 * - Connects to beads-server /ws endpoint
 * - Subscribes to workspace for mutation events
 * - Calls store.refreshTasks() on mutation:event messages
 * - Exponential backoff reconnection (1s → 2s → 4s → ... capped at 30s)
 * - StrictMode safety via setTimeout(fn, 0)
 *
 * @example
 * ```tsx
 * function TaskList() {
 *   const { isConnected } = useTaskMutations()
 *   // Tasks will auto-refresh when mutations occur
 * }
 * ```
 */
export function useTaskMutations(options: UseTaskMutationsOptions = {}): UseTaskMutationsResult {
  const { enabled = true, workspacePath, onMutation } = options

  const [isConnected, setIsConnected] = useState(false)

  // Use refs for mutable state that shouldn't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const intentionalCloseRef = useRef(false)
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get workspace path from options or fall back to API client config
  const resolvedWorkspacePath = workspacePath ?? getApiClientConfig().workspacePath

  const connect = useCallback(() => {
    // Don't connect if intentionally closed
    if (intentionalCloseRef.current) return

    // Build WebSocket URL from API client base URL
    const config = getApiClientConfig()
    const wsUrl = buildWsUrl(config.baseUrl, "/ws")

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      // Reset backoff on successful connection
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY

      // Subscribe to workspace
      if (resolvedWorkspacePath) {
        ws.send(
          JSON.stringify({
            type: "ws:subscribe_workspace",
            workspace: resolvedWorkspacePath,
          }),
        )
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as { type: string; [key: string]: unknown }

        if (message.type === "mutation:event") {
          const mutationMessage = message as unknown as MutationEventMessage
          // Call onMutation callback if provided
          onMutation?.(mutationMessage.event)
          // Refresh tasks in the store
          beadsViewStore.getState().refreshTasks()
        }
      } catch {
        // Ignore parse errors
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null

      // Schedule reconnection if not intentionally closed
      if (!intentionalCloseRef.current) {
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      // Error will trigger onclose, which handles reconnection
    }
  }, [resolvedWorkspacePath, onMutation])

  const scheduleReconnect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const delay = reconnectDelayRef.current

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null
      connect()
    }, delay)

    // Increase delay for next attempt (exponential backoff)
    reconnectDelayRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_RECONNECT_DELAY)
  }, [connect])

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true

    // Clear pending connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }

    // Clear pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      disconnect()
      return
    }

    // Reset intentional close flag
    intentionalCloseRef.current = false

    // Use setTimeout(fn, 0) for StrictMode safety
    // This prevents double connection when React mounts/unmounts/remounts in dev mode
    connectionTimeoutRef.current = setTimeout(() => {
      connectionTimeoutRef.current = null
      connect()
    }, 0)

    return () => {
      disconnect()
    }
  }, [enabled, resolvedWorkspacePath, connect, disconnect])

  return { isConnected }
}
