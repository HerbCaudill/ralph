/**
 * SharedWorker for managing the Ralph loop WebSocket connection.
 *
 * This worker owns the WebSocket connection to the agent server (app=ralph),
 * manages ralph loop state (running/paused/idle), and broadcasts events
 * to all connected browser tabs.
 */

// SharedWorker global scope type declaration
declare const self: SharedWorkerGlobalScope

interface WorkerLocation {
  readonly protocol: string
  readonly host: string
}

interface SharedWorkerGlobalScope {
  onconnect: ((event: MessageEvent) => void) | null
  location: WorkerLocation
}

/** Control state for the Ralph loop. Matches agent-view ControlState. */
export type ControlState = "idle" | "running" | "paused"

/** Messages sent from browser tabs to the worker. */
export type WorkerMessage =
  | { type: "start"; sessionId?: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "message"; text: string }
  | { type: "get_state" }

/** Events broadcast from the worker to all connected tabs. */
export type WorkerEvent =
  | { type: "state_change"; state: ControlState }
  | { type: "event"; event: unknown }
  | { type: "error"; error: string }
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "session_created"; sessionId: string }
  | { type: "pending_events"; events: unknown[] }

/** Set of all connected MessagePorts from browser tabs. */
const ports: Set<MessagePort> = new Set()

/** Current control state of the Ralph loop. */
let controlState: ControlState = "idle"

/** WebSocket connection to the agent server. */
let ws: WebSocket | null = null

/** Current session ID for the Ralph loop. */
let currentSessionId: string | null = null

/** Reconnection timer reference. */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

/** Keep-alive ping interval reference. */
let pingInterval: ReturnType<typeof setInterval> | null = null

/**
 * Broadcast an event to all connected browser tabs.
 */
function broadcast(event: WorkerEvent): void {
  ports.forEach(port => {
    try {
      port.postMessage(event)
    } catch {
      // Port may be closed, remove it
      ports.delete(port)
    }
  })
}

/**
 * Update control state and broadcast the change.
 */
function setControlState(newState: ControlState): void {
  if (controlState !== newState) {
    controlState = newState
    broadcast({ type: "state_change", state: newState })
  }
}

/**
 * Construct the WebSocket URL for the Ralph app.
 */
function getWebSocketUrl(): string {
  const protocol = self.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${self.location.host}/ws?app=ralph`
}

/**
 * Connect to the agent server WebSocket.
 */
function connect(): void {
  // Clean up existing connection
  if (ws) {
    ws.close()
    ws = null
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  try {
    ws = new WebSocket(getWebSocketUrl())

    ws.onopen = () => {
      broadcast({ type: "connected" })

      // Start keep-alive pings
      if (pingInterval) {
        clearInterval(pingInterval)
      }
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }))
        }
      }, 30000)

      // If we were running before disconnect, try to resume
      if (controlState === "running" && currentSessionId && ws) {
        ws.send(
          JSON.stringify({
            type: "reconnect",
            sessionId: currentSessionId,
          }),
        )
      }
    }

    ws.onmessage = e => {
      try {
        const message = JSON.parse(e.data as string) as Record<string, unknown>

        // Handle pong silently
        if (message.type === "pong") return

        // Handle session created
        if (message.type === "session_created") {
          currentSessionId = message.sessionId as string
          broadcast({ type: "session_created", sessionId: currentSessionId })

          // Fetch and send the Ralph prompt as the first user message (like the CLI does)
          if (controlState === "running") {
            fetch(`${self.location.protocol}//${self.location.host}/api/prompts/ralph`)
              .then(res => res.json())
              .then((data: { prompt: string }) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: "message",
                      sessionId: currentSessionId,
                      message: data.prompt,
                      isSystemPrompt: true,
                    }),
                  )
                }
              })
              .catch(err => {
                broadcast({ type: "error", error: `Failed to load Ralph prompt: ${err.message}` })
              })
          }
          return
        }

        // Handle pending events on reconnect
        if (message.type === "pending_events") {
          const events = message.events as unknown[]
          if (events?.length) {
            broadcast({ type: "pending_events", events })
          }
          return
        }

        // Handle status changes
        if (message.type === "status") {
          const status = message.status as string
          // If status is "idle" or "completed", we might auto-continue
          if (controlState === "running" && status === "completed") {
            // Auto-continue logic would go here - check for ready tasks
          }
          // Broadcast the raw event
          broadcast({ type: "event", event: message })
          return
        }

        // Handle errors
        if (message.type === "error") {
          broadcast({ type: "error", error: message.error as string })
          return
        }

        // Forward all other events (except user messages, like the CLI does)
        if (message.type === "event" && message.event) {
          const event = message.event as Record<string, unknown>
          // Skip user messages (initial prompt, user inputs)
          // Only show assistant and result messages
          if (event.type !== "user") {
            broadcast({ type: "event", event: message.event })
          }
          return
        }

        // Forward any other message as an event (except user messages)
        if (message.type !== "user") {
          broadcast({ type: "event", event: message })
        }
      } catch {
        // Ignore unparseable messages
      }
    }

    ws.onclose = () => {
      broadcast({ type: "disconnected" })
      ws = null

      if (pingInterval) {
        clearInterval(pingInterval)
        pingInterval = null
      }

      // Auto-reconnect after 3 seconds if we have connected ports
      // This maintains connection status even when idle
      if (ports.size > 0) {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => {
      broadcast({ type: "error", error: "WebSocket connection failed" })
    }
  } catch (err) {
    broadcast({ type: "error", error: `Failed to connect: ${(err as Error).message}` })
  }
}

/**
 * Disconnect from the WebSocket.
 */
function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }

  if (ws) {
    ws.close()
    ws = null
  }
}

/**
 * Create a new session or resume an existing one.
 */
function createOrResumeSession(sessionId?: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    broadcast({ type: "error", error: "WebSocket not connected" })
    return
  }

  if (sessionId) {
    // Resume existing session
    currentSessionId = sessionId
    ws.send(
      JSON.stringify({
        type: "reconnect",
        sessionId,
      }),
    )
  } else {
    // Create new session
    ws.send(
      JSON.stringify({
        type: "create_session",
        app: "ralph",
      }),
    )
  }
}

/**
 * Send a message to the current session.
 */
function sendMessage(text: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    broadcast({ type: "error", error: "WebSocket not connected" })
    return
  }

  if (!currentSessionId) {
    broadcast({ type: "error", error: "No active session" })
    return
  }

  ws.send(
    JSON.stringify({
      type: "message",
      sessionId: currentSessionId,
      message: text,
    }),
  )
}

/**
 * Handle a message from a connected browser tab.
 */
function handlePortMessage(message: WorkerMessage, port: MessagePort): void {
  switch (message.type) {
    case "start":
      if (controlState === "idle") {
        setControlState("running")
        // Connect if not already connected
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          connect()
        }
        // Wait for connection, then create/resume session
        const checkConnection = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection)
            createOrResumeSession(message.sessionId)
          }
        }, 100)
        // Timeout after 10 seconds
        setTimeout(() => clearInterval(checkConnection), 10000)
      }
      break

    case "pause":
      if (controlState === "running") {
        setControlState("paused")
        // Keep connection open but don't auto-continue
      }
      break

    case "resume":
      if (controlState === "paused") {
        setControlState("running")
        // Check for ready tasks and potentially auto-continue
      }
      break

    case "stop":
      setControlState("idle")
      currentSessionId = null
      disconnect()
      break

    case "message":
      if (controlState !== "idle") {
        sendMessage(message.text)
      } else {
        broadcast({ type: "error", error: "Ralph is not running" })
      }
      break

    case "get_state":
      // Send current state to the requesting port only
      port.postMessage({
        type: "state_change",
        state: controlState,
      } satisfies WorkerEvent)
      if (currentSessionId) {
        port.postMessage({
          type: "session_created",
          sessionId: currentSessionId,
        } satisfies WorkerEvent)
      }
      break
  }
}

// SharedWorker connection handler
self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0]
  ports.add(port)

  port.onmessage = (event: MessageEvent<WorkerMessage>) => {
    handlePortMessage(event.data, port)
  }

  port.onmessageerror = () => {
    ports.delete(port)
    // Disconnect if no ports remain
    if (ports.size === 0) {
      disconnect()
    }
  }

  // Send current state to the new port
  port.postMessage({
    type: "state_change",
    state: controlState,
  } satisfies WorkerEvent)

  // Send session ID if we have one
  if (currentSessionId) {
    port.postMessage({
      type: "session_created",
      sessionId: currentSessionId,
    } satisfies WorkerEvent)
  }

  // Notify if already connected
  if (ws?.readyState === WebSocket.OPEN) {
    port.postMessage({ type: "connected" } satisfies WorkerEvent)
  } else if (!ws && ports.size === 1) {
    // First port connected and no WebSocket exists - connect now
    // This allows the UI to show connection status without waiting for "start"
    connect()
  }

  port.start()
}
