import { useCallback, useEffect, useRef, useState } from "react"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

export interface UseWebSocketOptions {
  /**
   * The WebSocket URL to connect to.
   * Defaults to `ws://${window.location.host}/ws`.
   */
  url?: string

  /**
   * Whether to automatically connect on mount.
   * @default true
   */
  autoConnect?: boolean

  /**
   * Whether to automatically reconnect on disconnection.
   * @default true
   */
  autoReconnect?: boolean

  /**
   * Delay in milliseconds before attempting to reconnect.
   * @default 1000
   */
  reconnectDelay?: number

  /**
   * Maximum number of reconnection attempts before giving up.
   * Set to 0 for unlimited attempts.
   * @default 0
   */
  maxReconnectAttempts?: number

  /**
   * Callback when a message is received.
   */
  onMessage?: (data: unknown) => void

  /**
   * Callback when the connection is established.
   */
  onConnect?: () => void

  /**
   * Callback when the connection is closed.
   */
  onDisconnect?: (event: CloseEvent) => void

  /**
   * Callback when a connection error occurs.
   */
  onError?: (error: Event) => void
}

export interface UseWebSocketReturn {
  /**
   * Current connection status.
   */
  status: ConnectionStatus

  /**
   * Whether the connection is currently open.
   */
  isConnected: boolean

  /**
   * Send a message through the WebSocket.
   * The message will be JSON-stringified if it's not already a string.
   */
  send: (message: unknown) => void

  /**
   * Manually connect to the WebSocket server.
   */
  connect: () => void

  /**
   * Manually disconnect from the WebSocket server.
   */
  disconnect: () => void

  /**
   * Number of reconnection attempts made.
   */
  reconnectAttempts: number
}

function getDefaultUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}/ws`
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    autoReconnect = true,
    reconnectDelay = 1000,
    maxReconnectAttempts = 0,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options

  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalCloseRef = useRef(false)
  const mountedRef = useRef(true)
  const reconnectAttemptsRef = useRef(0)

  // Store callbacks in refs to avoid reconnecting on callback changes
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onMessageRef.current = onMessage
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onErrorRef.current = onError
  }, [onMessage, onConnect, onDisconnect, onError])

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    // Don't connect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return
    }

    // Close any existing connection
    if (wsRef.current) {
      intentionalCloseRef.current = true
      wsRef.current.close()
      wsRef.current = null
    }

    clearReconnectTimeout()
    intentionalCloseRef.current = false

    const wsUrl = url ?? getDefaultUrl()
    setStatus("connecting")

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // Ignore events from stale WebSocket instances (can happen with StrictMode)
      if (!mountedRef.current || wsRef.current !== ws) return
      setStatus("connected")
      reconnectAttemptsRef.current = 0
      setReconnectAttempts(0)
      onConnectRef.current?.()
    }

    ws.onmessage = (event: MessageEvent) => {
      // Ignore events from stale WebSocket instances
      if (!mountedRef.current || wsRef.current !== ws) return
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {
        // If JSON parsing fails, pass the raw data
        onMessageRef.current?.(event.data)
      }
    }

    ws.onerror = (error: Event) => {
      // Ignore events from stale WebSocket instances
      if (!mountedRef.current || wsRef.current !== ws) return
      onErrorRef.current?.(error)
    }

    ws.onclose = (event: CloseEvent) => {
      // Ignore events from stale WebSocket instances (critical for StrictMode)
      if (!mountedRef.current || wsRef.current !== ws) return
      setStatus("disconnected")
      onDisconnectRef.current?.(event)

      // Schedule reconnection if not intentionally closed
      if (
        autoReconnect &&
        !intentionalCloseRef.current &&
        (maxReconnectAttempts === 0 || reconnectAttemptsRef.current < maxReconnectAttempts)
      ) {
        clearReconnectTimeout()
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            reconnectAttemptsRef.current += 1
            setReconnectAttempts(reconnectAttemptsRef.current)
            connect()
          }
        }, reconnectDelay)
      }
    }
  }, [url, autoReconnect, reconnectDelay, maxReconnectAttempts, clearReconnectTimeout])

  const disconnect = useCallback(() => {
    clearReconnectTimeout()
    intentionalCloseRef.current = true

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus("disconnected")
  }, [clearReconnectTimeout])

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = typeof message === "string" ? message : JSON.stringify(message)
      wsRef.current.send(payload)
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true

    if (autoConnect) {
      connect()
    }

    return () => {
      mountedRef.current = false
      clearReconnectTimeout()
      intentionalCloseRef.current = true

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    isConnected: status === "connected",
    send,
    connect,
    disconnect,
    reconnectAttempts,
  }
}
