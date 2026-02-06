/**
 * SharedWorker for managing Ralph loop WebSocket connections per workspace.
 *
 * Maintains a Map of workspace states — each workspace has its own
 * WebSocket connection, control state, and session ID. Browser tabs
 * subscribe to a workspace to receive scoped events.
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

/** Per-workspace state managed by the worker. */
interface WorkspaceState {
  controlState: ControlState
  currentSessionId: string | null
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  pingInterval: ReturnType<typeof setInterval> | null
  /** Ports subscribed to this workspace's events. */
  subscribedPorts: Set<MessagePort>
}

/** Messages sent from browser tabs to the worker. */
export type WorkerMessage =
  | { type: "subscribe_workspace"; workspaceId: string }
  | { type: "start"; workspaceId: string; sessionId?: string }
  | { type: "pause"; workspaceId: string }
  | { type: "resume"; workspaceId: string }
  | { type: "stop"; workspaceId: string }
  | { type: "message"; workspaceId: string; text: string }
  | { type: "get_state"; workspaceId: string }

/** Events broadcast from the worker to connected tabs. */
export type WorkerEvent =
  | { type: "state_change"; workspaceId: string; state: ControlState }
  | { type: "event"; workspaceId: string; event: unknown }
  | { type: "error"; workspaceId: string; error: string }
  | { type: "connected"; workspaceId: string }
  | { type: "disconnected"; workspaceId: string }
  | { type: "session_created"; workspaceId: string; sessionId: string }
  | { type: "pending_events"; workspaceId: string; events: unknown[] }

/** All connected ports (for cleanup). */
const allPorts: Set<MessagePort> = new Set()

/** Per-workspace state keyed by workspace ID (owner/repo). */
const workspaces = new Map<string, WorkspaceState>()

/** Get or create state for a workspace. */
function getWorkspace(workspaceId: string): WorkspaceState {
  let state = workspaces.get(workspaceId)
  if (!state) {
    state = {
      controlState: "idle",
      currentSessionId: null,
      ws: null,
      reconnectTimer: null,
      pingInterval: null,
      subscribedPorts: new Set(),
    }
    workspaces.set(workspaceId, state)
  }
  return state
}

/** Broadcast an event to all ports subscribed to a workspace. */
function broadcastToWorkspace(workspaceId: string, event: WorkerEvent): void {
  const state = workspaces.get(workspaceId)
  if (!state) return
  state.subscribedPorts.forEach(port => {
    try {
      port.postMessage(event)
    } catch {
      state.subscribedPorts.delete(port)
      allPorts.delete(port)
    }
  })
}

/** Update control state and broadcast the change. */
function setControlState(workspaceId: string, newState: ControlState): void {
  const state = getWorkspace(workspaceId)
  if (state.controlState !== newState) {
    state.controlState = newState
    broadcastToWorkspace(workspaceId, { type: "state_change", workspaceId, state: newState })
  }
}

/** Construct the WebSocket URL for a workspace. */
function getWebSocketUrl(workspaceId: string): string {
  const protocol = self.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${self.location.host}/ws?app=ralph&workspace=${encodeURIComponent(workspaceId)}`
}

/** Connect to the agent server WebSocket for a workspace. */
function connectWorkspace(workspaceId: string): void {
  const state = getWorkspace(workspaceId)

  // Clean up existing connection
  if (state.ws) {
    state.ws.close()
    state.ws = null
  }

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }

  try {
    state.ws = new WebSocket(getWebSocketUrl(workspaceId))

    state.ws.onopen = () => {
      broadcastToWorkspace(workspaceId, { type: "connected", workspaceId })

      // Start keep-alive pings
      if (state.pingInterval) {
        clearInterval(state.pingInterval)
      }
      state.pingInterval = setInterval(() => {
        if (state.ws?.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({ type: "ping" }))
        }
      }, 30000)

      // If we were running before disconnect, try to resume
      if (state.controlState === "running" && state.currentSessionId && state.ws) {
        state.ws.send(
          JSON.stringify({
            type: "reconnect",
            sessionId: state.currentSessionId,
          }),
        )
      }
    }

    state.ws.onmessage = e => {
      try {
        const message = JSON.parse(e.data as string) as Record<string, unknown>

        if (message.type === "pong") return

        if (message.type === "session_created") {
          state.currentSessionId = message.sessionId as string
          broadcastToWorkspace(workspaceId, {
            type: "session_created",
            workspaceId,
            sessionId: state.currentSessionId,
          })

          // Fetch and send the Ralph prompt as the first user message
          if (state.controlState === "running") {
            fetch(`${self.location.protocol}//${self.location.host}/api/prompts/ralph`)
              .then(res => res.json())
              .then((data: { prompt: string }) => {
                if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                  state.ws.send(
                    JSON.stringify({
                      type: "message",
                      sessionId: state.currentSessionId,
                      message: data.prompt,
                      isSystemPrompt: true,
                    }),
                  )
                }
              })
              .catch(err => {
                broadcastToWorkspace(workspaceId, {
                  type: "error",
                  workspaceId,
                  error: `Failed to load Ralph prompt: ${err.message}`,
                })
              })
          }
          return
        }

        if (message.type === "pending_events") {
          const events = message.events as unknown[]
          if (events?.length) {
            broadcastToWorkspace(workspaceId, { type: "pending_events", workspaceId, events })
          }
          return
        }

        if (message.type === "status") {
          broadcastToWorkspace(workspaceId, { type: "event", workspaceId, event: message })
          return
        }

        if (message.type === "error") {
          broadcastToWorkspace(workspaceId, {
            type: "error",
            workspaceId,
            error: message.error as string,
          })
          return
        }

        if (message.type === "event" && message.event) {
          const event = message.event as Record<string, unknown>
          if (event.type !== "user") {
            broadcastToWorkspace(workspaceId, { type: "event", workspaceId, event: message.event })
          }
          return
        }

        if (message.type !== "user") {
          broadcastToWorkspace(workspaceId, { type: "event", workspaceId, event: message })
        }
      } catch {
        // Ignore unparseable messages
      }
    }

    state.ws.onclose = () => {
      broadcastToWorkspace(workspaceId, { type: "disconnected", workspaceId })
      state.ws = null

      if (state.pingInterval) {
        clearInterval(state.pingInterval)
        state.pingInterval = null
      }

      // Auto-reconnect after 3 seconds if there are subscribed ports
      if (state.subscribedPorts.size > 0) {
        state.reconnectTimer = setTimeout(() => connectWorkspace(workspaceId), 3000)
      }
    }

    state.ws.onerror = () => {
      broadcastToWorkspace(workspaceId, {
        type: "error",
        workspaceId,
        error: "WebSocket connection failed",
      })
    }
  } catch (err) {
    broadcastToWorkspace(workspaceId, {
      type: "error",
      workspaceId,
      error: `Failed to connect: ${(err as Error).message}`,
    })
  }
}

/** Disconnect a workspace's WebSocket. */
function disconnectWorkspace(workspaceId: string): void {
  const state = workspaces.get(workspaceId)
  if (!state) return

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }

  if (state.pingInterval) {
    clearInterval(state.pingInterval)
    state.pingInterval = null
  }

  if (state.ws) {
    state.ws.close()
    state.ws = null
  }
}

/** Create a new session or resume an existing one for a workspace. */
function createOrResumeSession(workspaceId: string, sessionId?: string): void {
  const state = getWorkspace(workspaceId)
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    broadcastToWorkspace(workspaceId, {
      type: "error",
      workspaceId,
      error: "WebSocket not connected",
    })
    return
  }

  if (sessionId) {
    state.currentSessionId = sessionId
    state.ws.send(JSON.stringify({ type: "reconnect", sessionId }))
  } else {
    state.ws.send(
      JSON.stringify({
        type: "create_session",
        app: "ralph",
        workspaceId,
      }),
    )
  }
}

/** Send a message to the current session for a workspace. */
function sendMessageToWorkspace(workspaceId: string, text: string): void {
  const state = getWorkspace(workspaceId)
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    broadcastToWorkspace(workspaceId, {
      type: "error",
      workspaceId,
      error: "WebSocket not connected",
    })
    return
  }

  if (!state.currentSessionId) {
    broadcastToWorkspace(workspaceId, {
      type: "error",
      workspaceId,
      error: "No active session",
    })
    return
  }

  state.ws.send(
    JSON.stringify({
      type: "message",
      sessionId: state.currentSessionId,
      message: text,
    }),
  )
}

/** Handle a message from a connected browser tab. */
function handlePortMessage(message: WorkerMessage, port: MessagePort): void {
  switch (message.type) {
    case "subscribe_workspace": {
      const state = getWorkspace(message.workspaceId)
      state.subscribedPorts.add(port)

      // Send current state to the subscribing port
      port.postMessage({
        type: "state_change",
        workspaceId: message.workspaceId,
        state: state.controlState,
      } satisfies WorkerEvent)

      if (state.currentSessionId) {
        port.postMessage({
          type: "session_created",
          workspaceId: message.workspaceId,
          sessionId: state.currentSessionId,
        } satisfies WorkerEvent)
      }

      // Connect if not already connected
      if (state.ws?.readyState === WebSocket.OPEN) {
        port.postMessage({
          type: "connected",
          workspaceId: message.workspaceId,
        } satisfies WorkerEvent)
      } else if (!state.ws) {
        connectWorkspace(message.workspaceId)
      }
      break
    }

    case "start": {
      const state = getWorkspace(message.workspaceId)
      if (state.controlState === "idle") {
        setControlState(message.workspaceId, "running")
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
          connectWorkspace(message.workspaceId)
        }
        const checkConnection = setInterval(() => {
          if (state.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection)
            createOrResumeSession(message.workspaceId, message.sessionId)
          }
        }, 100)
        setTimeout(() => clearInterval(checkConnection), 10000)
      }
      break
    }

    case "pause": {
      const state = getWorkspace(message.workspaceId)
      if (state.controlState === "running") {
        setControlState(message.workspaceId, "paused")
      }
      break
    }

    case "resume": {
      const state = getWorkspace(message.workspaceId)
      if (state.controlState === "paused") {
        setControlState(message.workspaceId, "running")
      }
      break
    }

    case "stop":
      setControlState(message.workspaceId, "idle")
      getWorkspace(message.workspaceId).currentSessionId = null
      disconnectWorkspace(message.workspaceId)
      break

    case "message": {
      const state = getWorkspace(message.workspaceId)
      if (state.controlState !== "idle") {
        sendMessageToWorkspace(message.workspaceId, message.text)
      } else {
        broadcastToWorkspace(message.workspaceId, {
          type: "error",
          workspaceId: message.workspaceId,
          error: "Ralph is not running",
        })
      }
      break
    }

    case "get_state": {
      const state = getWorkspace(message.workspaceId)
      port.postMessage({
        type: "state_change",
        workspaceId: message.workspaceId,
        state: state.controlState,
      } satisfies WorkerEvent)
      if (state.currentSessionId) {
        port.postMessage({
          type: "session_created",
          workspaceId: message.workspaceId,
          sessionId: state.currentSessionId,
        } satisfies WorkerEvent)
      }
      break
    }
  }
}

/** Remove a port from all workspace subscriptions. */
function removePort(port: MessagePort): void {
  allPorts.delete(port)
  for (const [workspaceId, state] of workspaces) {
    state.subscribedPorts.delete(port)
    // Disconnect workspace if no subscribers remain
    if (state.subscribedPorts.size === 0) {
      disconnectWorkspace(workspaceId)
    }
  }
}

// SharedWorker connection handler
self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0]
  allPorts.add(port)

  port.onmessage = (event: MessageEvent<WorkerMessage>) => {
    handlePortMessage(event.data, port)
  }

  port.onmessageerror = () => {
    removePort(port)
  }

  port.start()
}
