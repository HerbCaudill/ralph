import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatEvent } from "../types"
import { addSession, listSessions, removeSession, updateSession } from "../lib/sessionIndex"

export type AgentType = "claude" | "codex"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

const DEFAULT_SESSION_ID_KEY = "agent-chat-session-id"
const DEFAULT_AGENT_TYPE_KEY = "agent-chat-agent-type"

function getSessionIdKey(storageKey?: string): string {
  return storageKey ? `${storageKey}-session-id` : DEFAULT_SESSION_ID_KEY
}

function getAgentTypeKey(storageKey?: string): string {
  return storageKey ? `${storageKey}-agent-type` : DEFAULT_AGENT_TYPE_KEY
}

function loadSessionId(storageKey?: string): string | null {
  try {
    return localStorage.getItem(getSessionIdKey(storageKey))
  } catch {
    return null
  }
}

function saveSessionId(id: string | null, storageKey?: string) {
  try {
    const key = getSessionIdKey(storageKey)
    if (id) {
      localStorage.setItem(key, id)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignore storage errors
  }
}

function loadAgentType(storageKey?: string): AgentType | null {
  try {
    const stored = localStorage.getItem(getAgentTypeKey(storageKey))
    if (stored === "claude" || stored === "codex") return stored
    return null
  } catch {
    return null
  }
}

function saveAgentType(type: AgentType, storageKey?: string) {
  try {
    localStorage.setItem(getAgentTypeKey(storageKey), type)
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
  restoreSession: (sessionId: string) => void
}

/**
 * Hook that manages the WebSocket connection to the agent server
 * and provides chat state + actions using the session-based protocol.
 */
export type UseAgentChatOptions = {
  /** Initial agent type, defaults to "claude" */
  initialAgent?: AgentType
  /** System prompt to use when creating sessions */
  systemPrompt?: string
  /** Unique key for localStorage persistence (allows multiple independent chat instances) */
  storageKey?: string
  /** App namespace for session storage (e.g., "ralph", "task-chat"). Sessions are stored in separate directories per app. */
  app?: string
  /** Workspace identifier (e.g., "owner/repo"). Pass null to prevent workspace derivation. If omitted, auto-derived from cwd. */
  workspace?: string | null
  /** Allowed tools for new sessions. If omitted, adapter defaults are used. */
  allowedTools?: string[]
}

export function useAgentChat(optionsOrAgent: AgentType | UseAgentChatOptions = "claude") {
  // Support both legacy AgentType argument and new options object
  const options: UseAgentChatOptions =
    typeof optionsOrAgent === "string" ? { initialAgent: optionsOrAgent } : optionsOrAgent
  const {
    initialAgent = "claude",
    systemPrompt,
    storageKey,
    app,
    workspace,
    allowedTools,
  } = options
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const [agentType, _setAgentType] = useState<AgentType>(
    () => loadAgentType(storageKey) ?? initialAgent,
  )
  const [sessionId, _setSessionId] = useState<string | null>(() => loadSessionId(storageKey))

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef<string | null>(sessionId)
  const prevStorageKeyRef = useRef(storageKey)

  // Wrapper that persists sessionId to localStorage
  const setSessionId = useCallback(
    (id: string | null) => {
      _setSessionId(id)
      sessionIdRef.current = id
      saveSessionId(id, storageKey)
    },
    [storageKey],
  )

  // Wrapper that persists agentType to localStorage
  const setAgentType = useCallback(
    (type: AgentType) => {
      _setAgentType(type)
      saveAgentType(type, storageKey)
    },
    [storageKey],
  )

  /** Create a new session via REST, then subscribe via WS. */
  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapter: agentType, systemPrompt, app, workspace, allowedTools }),
      })
      const data = (await res.json()) as { sessionId: string }
      setSessionId(data.sessionId)
      setEvents([])
      setError(null)

      // Write new session to the session index
      const now = Date.now()
      addSession({
        sessionId: data.sessionId,
        adapter: agentType,
        firstMessageAt: now,
        lastMessageAt: now,
        firstUserMessage: "",
      })

      return data.sessionId
    } catch {
      setError("Failed to create session")
      return null
    }
  }, [agentType, systemPrompt, app, allowedTools, setSessionId])

  /**
   * Try to restore a previous session from localStorage or the session index.
   * If no session can be restored, leaves sessionId as null — a session will
   * be created lazily when the user sends their first message.
   */
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
    const storedSessionId = loadSessionId(storageKey)
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

    // Fall back to session index (most recent session), but only when
    // no storageKey is provided. When a storageKey is set (workspace-scoped
    // usage), the global session index is unpartitioned and would return
    // sessions from other workspaces — so we skip this fallback entirely.
    if (!storageKey) {
      const indexedSessions = listSessions()
      if (indexedSessions.length > 0) {
        const mostRecent = indexedSessions[0]
        try {
          const res = await fetch(`/api/sessions/${mostRecent.sessionId}`)
          if (res.ok) {
            const sessionInfo = (await res.json()) as {
              sessionId: string
              status?: string
              adapter?: string
            }
            setSessionId(mostRecent.sessionId)
            restoreSessionState(sessionInfo)

            // Reconnect to get pending events
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "reconnect",
                  sessionId: mostRecent.sessionId,
                }),
              )
            }
            return
          }
        } catch {
          // Session no longer valid on server, fall through
        }
      }
    }

    // No restorable session found — leave sessionId null.
    // A session will be created lazily on first sendMessage.
  }, [setSessionId, setAgentType, storageKey])

  // When storageKey changes (e.g. workspace switch), reset session state
  // and re-initialize from the new storage key.
  useEffect(() => {
    if (storageKey === prevStorageKeyRef.current) return
    prevStorageKeyRef.current = storageKey

    // Clear session state for the old workspace
    setEvents([])
    setIsStreaming(false)
    setError(null)
    _setSessionId(null)
    sessionIdRef.current = null

    // Re-initialize from the new storage key
    initSession()
  }, [storageKey, initSession])

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
            // Mark session as having a response (tool_use is an assistant action)
            const currentSid = sessionIdRef.current
            if (currentSid) {
              updateSession(currentSid, { hasResponse: true })
            }
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

          // For user_message events, deduplicate based on message content
          // (the client adds the message optimistically, then the server echoes it back)
          if (event.type === "user_message") {
            setEvents(prev => {
              const messageText = (event as ChatEvent & { message?: string }).message
              const alreadyExists = prev.some(
                e =>
                  e.type === "user_message" &&
                  (e as ChatEvent & { message?: string }).message === messageText,
              )
              if (alreadyExists) {
                return prev
              }
              return [...prev, event]
            })
            return
          }

          // Mark session as having a response for non-user events
          if (event.type !== "user_message") {
            const currentSid = sessionIdRef.current
            if (currentSid) {
              updateSession(currentSid, { hasResponse: true })
            }
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
          // Mark session as having a response for assistant messages
          if (chatEvent.type === "assistant_text") {
            const currentSid = sessionIdRef.current
            if (currentSid) {
              updateSession(currentSid, { hasResponse: true })
            }
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

  // Connect on mount, disconnect on unmount.
  // Deferred with setTimeout(0) so React StrictMode's synchronous
  // mount→unmount→remount cycle doesn't create a WebSocket that is
  // immediately closed — which causes ECONNRESET on the Vite WS proxy.
  useEffect(() => {
    const connectTimer = setTimeout(connect, 0)

    // Keep-alive ping
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }))
      }
    }, 30000)

    return () => {
      clearTimeout(connectTimer)
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

  /** Send a WS message on the given session. */
  const sendViaWs = useCallback((targetSessionId: string, trimmedMessage: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          sessionId: targetSessionId,
          message: trimmedMessage,
        }),
      )
      setIsStreaming(true)
      setError(null)
    } else {
      // Fallback to REST
      fetch(`/api/sessions/${targetSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      }).catch(() => {
        setError("Failed to send message")
      })
    }
  }, [])

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return

      const trimmedMessage = message.trim()
      const now = Date.now()

      // Add user message event locally
      const userEvent: ChatEvent = {
        type: "user_message",
        message: trimmedMessage,
        timestamp: now,
      }
      setEvents(prev => {
        // Update session index: set lastMessageAt, and firstUserMessage if this is the first
        const currentSid = sessionIdRef.current
        if (currentSid) {
          const isFirstUserMessage = !prev.some(e => e.type === "user_message")
          const updates: { lastMessageAt: number; firstUserMessage?: string } = {
            lastMessageAt: now,
          }
          if (isFirstUserMessage) {
            updates.firstUserMessage = trimmedMessage
          }
          updateSession(currentSid, updates)
        }
        return [...prev, userEvent]
      })

      const currentSessionId = sessionIdRef.current

      if (currentSessionId) {
        // Session exists — send directly
        sendViaWs(currentSessionId, trimmedMessage)
      } else {
        // No session yet — create one lazily, then send
        createSession().then(newSessionId => {
          if (newSessionId) {
            sendViaWs(newSessionId, trimmedMessage)
          }
        })
      }
    },
    [createSession, sendViaWs],
  )

  const clearHistory = useCallback(() => {
    const currentSessionId = sessionIdRef.current
    setEvents([])
    setIsStreaming(false)
    setError(null)

    if (currentSessionId) {
      // Remove from session index
      removeSession(currentSessionId)

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

  /** Switch to an existing session by ID. Fetches session info and reconnects the WebSocket. */
  const restoreSession = useCallback(
    async (targetSessionId: string) => {
      // Don't restore if it's already the current session
      if (targetSessionId === sessionIdRef.current) return

      setEvents([])
      setIsStreaming(false)
      setError(null)
      setSessionId(targetSessionId)

      // Fetch session info to restore adapter/streaming state
      try {
        const res = await fetch(`/api/sessions/${targetSessionId}`)
        if (res.ok) {
          const info = (await res.json()) as { status?: string; adapter?: string }
          if (info.status === "processing") {
            setIsStreaming(true)
          }
          if (info.adapter === "claude" || info.adapter === "codex") {
            setAgentType(info.adapter)
          }
        }
      } catch {
        // Continue even if fetch fails — we still have the session ID
      }

      // Ask the WebSocket to send pending events for this session
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "reconnect",
            sessionId: targetSessionId,
          }),
        )
      }
    },
    [setSessionId, setAgentType],
  )

  return {
    state: { events, isStreaming, connectionStatus, error, sessionId },
    actions: { sendMessage, clearHistory, setAgentType, newSession, restoreSession },
    agentType,
  }
}
