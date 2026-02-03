import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatEvent } from "../types"

export type AgentType = "claude" | "codex"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

const SESSION_ID_KEY = "agent-chat-session-id"
const AGENT_TYPE_KEY = "agent-chat-agent-type"

function loadSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_ID_KEY)
  } catch {
    return null
  }
}

function saveSessionId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(SESSION_ID_KEY, id)
    } else {
      localStorage.removeItem(SESSION_ID_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

function loadAgentType(): AgentType | null {
  try {
    const stored = localStorage.getItem(AGENT_TYPE_KEY)
    if (stored === "claude" || stored === "codex") return stored
    return null
  } catch {
    return null
  }
}

function saveAgentType(type: AgentType) {
  try {
    localStorage.setItem(AGENT_TYPE_KEY, type)
  } catch {
    // Ignore storage errors
  }
}

export type AgentChatState = {
  events: ChatEvent[]
  isStreaming: boolean
  connectionStatus: ConnectionStatus
  error: string | null
  sessionId: string | null
}

export type AgentChatActions = {
  sendMessage: (message: string) => void
  clearHistory: () => void
  setAgentType: (type: AgentType) => void
  newSession: () => void
}

/**
 * Hook that manages the WebSocket connection to the agent server
 * and provides chat state + actions using the session-based protocol.
 */
export function useAgentChat(initialAgent: AgentType = "claude") {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const [agentType, _setAgentType] = useState<AgentType>(() => loadAgentType() ?? initialAgent)
  const [sessionId, _setSessionId] = useState<string | null>(() => loadSessionId())

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId)

  // Wrapper that persists sessionId to localStorage
  const setSessionId = useCallback((id: string | null) => {
    _setSessionId(id)
    sessionIdRef.current = id
    saveSessionId(id)
  }, [])

  // Wrapper that persists agentType to localStorage
  const setAgentType = useCallback((type: AgentType) => {
    _setAgentType(type)
    saveAgentType(type)
  }, [])

  /** Create a new session via REST, then subscribe via WS. */
  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapter: agentType }),
      })
      const data = (await res.json()) as { sessionId: string }
      setSessionId(data.sessionId)
      setEvents([])
      setError(null)
      return data.sessionId
    } catch {
      setError("Failed to create session")
      return null
    }
  }, [agentType, setSessionId])

  /** Try to restore from localStorage, then /api/sessions/latest, or create new. */
  const initSession = useCallback(async () => {
    // Helper to restore streaming state and agent type from session info
    const restoreSessionState = (info: { status?: string; adapter?: string }) => {
      if (info.status === "processing") {
        setIsStreaming(true)
      }
      if (info.adapter === "claude" || info.adapter === "codex") {
        setAgentType(info.adapter)
      }
    }

    // Try restoring from localStorage first
    const storedSessionId = loadSessionId()
    if (storedSessionId) {
      try {
        const res = await fetch(`/api/sessions/${storedSessionId}`)
        if (res.ok) {
          const sessionInfo = (await res.json()) as {
            sessionId: string
            status?: string
            adapter?: string
          }
          setSessionId(storedSessionId)
          restoreSessionState(sessionInfo)

          // Reconnect to get pending events
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "reconnect",
                sessionId: storedSessionId,
              }),
            )
          }
          return
        }
      } catch {
        // Stored session no longer valid, fall through
      }
    }

    // Fall back to /api/sessions/latest
    try {
      const res = await fetch("/api/sessions/latest")
      if (res.ok) {
        const data = (await res.json()) as {
          sessionId: string
          status?: string
          adapter?: string
        }
        setSessionId(data.sessionId)
        restoreSessionState(data)

        // Reconnect to get pending events
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "reconnect",
              sessionId: data.sessionId,
            }),
          )
        }
        return
      }
    } catch {
      // No existing session, create new one
    }

    await createSession()
  }, [createSession, setSessionId, setAgentType])

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
      // Initialize session after WebSocket connects
      initSession()
    }

    ws.onmessage = e => {
      try {
        const message = JSON.parse(e.data as string) as Record<string, unknown>

        if (message.type === "pong") return

        if (message.type === "session_created") {
          setSessionId(message.sessionId as string)
          return
        }

        if (message.type === "session_cleared") {
          setEvents([])
          setSessionId(null)
          return
        }

        if (message.type === "status") {
          const status = message.status as string
          setIsStreaming(status === "processing")
          return
        }

        if (message.type === "error") {
          setError(message.error as string)
          return
        }

        if (message.type === "pending_events") {
          // Only apply events if they match the current session
          const msgSessionId = message.sessionId as string | undefined
          if (msgSessionId && sessionIdRef.current && msgSessionId !== sessionIdRef.current) {
            return
          }
          const pendingEvents = message.events as ChatEvent[]
          if (pendingEvents?.length) {
            setEvents(pendingEvents)
          }
          return
        }

        if (message.type === "event" && message.event) {
          const event = message.event as ChatEvent & { toolUseId?: string }

          // For tool_use events with the same toolUseId, replace the earlier version
          if (event.type === "tool_use" && event.toolUseId) {
            setEvents(prev => {
              const existingIndex = prev.findIndex(
                e =>
                  e.type === "tool_use" &&
                  (e as ChatEvent & { toolUseId?: string }).toolUseId === event.toolUseId,
              )
              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = event
                return updated
              }
              return [...prev, event]
            })
            return
          }

          setEvents(prev => [...prev, event])
          return
        }

        // Handle legacy message format
        if (message.type === "message") {
          const chatEvent: ChatEvent = {
            type: (message.role as string) === "user" ? "user_message" : "assistant_text",
            message: message.content as string,
            text: message.content as string,
            timestamp: Date.now(),
          }
          setEvents(prev => [...prev, chatEvent])
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
  }, [initSession])

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
      setEvents(prev => [...prev, userEvent])

      const currentSessionId = sessionIdRef.current

      // Send via WebSocket using session protocol
      if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionId) {
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            sessionId: currentSessionId,
            message: message.trim(),
          }),
        )
        setIsStreaming(true)
        setError(null)
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        // No session yet — use legacy protocol as fallback
        wsRef.current.send(
          JSON.stringify({
            type: "chat_message",
            message: message.trim(),
            agentType,
          }),
        )
        setIsStreaming(true)
        setError(null)
      } else {
        // Fallback to REST
        if (currentSessionId) {
          fetch(`/api/sessions/${currentSessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message.trim() }),
          }).catch(() => {
            setError("Failed to send message")
          })
        }
      }
    },
    [agentType],
  )

  const clearHistory = useCallback(() => {
    const currentSessionId = sessionIdRef.current
    setEvents([])
    setIsStreaming(false)
    setError(null)

    if (currentSessionId) {
      // Clear the session via REST
      fetch(`/api/sessions/${currentSessionId}`, { method: "DELETE" }).catch(() => {
        // Ignore errors
      })
    }

    setSessionId(null)
  }, [setSessionId])

  const newSession = useCallback(() => {
    setEvents([])
    setIsStreaming(false)
    setError(null)
    setSessionId(null)
    createSession()
  }, [createSession, setSessionId])

  return {
    state: { events, isStreaming, connectionStatus, error, sessionId },
    actions: { sendMessage, clearHistory, setAgentType, newSession },
    agentType,
  }
}
