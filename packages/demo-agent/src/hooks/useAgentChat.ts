import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatEvent } from "@herbcaudill/agent-view"

export type AgentType = "claude" | "codex"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

export type AgentChatState = {
  events: ChatEvent[]
  isStreaming: boolean
  connectionStatus: ConnectionStatus
  error: string | null
}

export type AgentChatActions = {
  sendMessage: (message: string) => void
  clearHistory: () => void
  setAgentType: (type: AgentType) => void
}

/**
 * Hook that manages the WebSocket connection to the agent server
 * and provides chat state + actions.
 */
export function useAgentChat(initialAgent: AgentType = "claude") {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const [agentType, setAgentType] = useState<AgentType>(initialAgent)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setConnectionStatus("connecting")
    setError(null)

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      setConnectionStatus("connected")
      setError(null)
    }

    ws.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data as string) as Record<string, unknown>

        if (message.type === "pong") return

        if (message.type === "status") {
          setIsStreaming((message.status as string) === "processing")
          return
        }

        if (message.type === "error") {
          setError(message.error as string)
          return
        }

        if (message.type === "event" && message.event) {
          setEvents((prev) => [...prev, message.event as ChatEvent])
          return
        }

        // Handle legacy message format
        if (message.type === "message") {
          const chatEvent: ChatEvent = {
            type:
              (message.role as string) === "user"
                ? "user_message"
                : "assistant_text",
            message: message.content as string,
            text: message.content as string,
            timestamp: Date.now(),
          }
          setEvents((prev) => [...prev, chatEvent])
        }
      } catch {
        // Ignore unparseable messages
      }
    }

    ws.onclose = () => {
      setConnectionStatus("disconnected")
      wsRef.current = null
      // Auto-reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      setError("WebSocket connection failed")
      setConnectionStatus("disconnected")
    }

    wsRef.current = ws
  }, [])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect()

    // Keep-alive ping
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }))
      }
    }, 30000)

    return () => {
      clearInterval(pingInterval)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return

      // Add user message event locally
      const userEvent: ChatEvent = {
        type: "user_message",
        message: message.trim(),
        timestamp: Date.now(),
      }
      setEvents((prev) => [...prev, userEvent])

      // Send via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "chat_message",
            message: message.trim(),
            agentType,
          })
        )
        setIsStreaming(true)
        setError(null)
      } else {
        // Fallback to REST
        fetch("/api/task-chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: message.trim(), agentType }),
        }).catch(() => {
          setError("Failed to send message")
        })
      }
    },
    [agentType]
  )

  const clearHistory = useCallback(() => {
    setEvents([])
    setIsStreaming(false)
    setError(null)

    // Notify server
    fetch("/api/task-chat/clear", { method: "POST" }).catch(() => {
      // Ignore errors
    })
  }, [])

  return {
    state: { events, isStreaming, connectionStatus, error },
    actions: { sendMessage, clearHistory, setAgentType },
    agentType,
  }
}
