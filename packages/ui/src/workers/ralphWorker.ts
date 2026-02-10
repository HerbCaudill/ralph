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
  /** Set when `<promise>COMPLETE</promise>` is detected; cleared on next session start. */
  sessionCompleted: boolean
  /** Set when user requests stop after current; prevents auto-start. */
  stopAfterCurrentPending: boolean
}

/** Messages sent from browser tabs to the worker. */
export type WorkerMessage =
  | { type: "subscribe_workspace"; workspaceId: string }
  | { type: "unsubscribe_workspace"; workspaceId: string }
  | { type: "start"; workspaceId: string; sessionId?: string }
  | { type: "pause"; workspaceId: string }
  | { type: "resume"; workspaceId: string }
  | { type: "stop_after_current"; workspaceId: string }
  | { type: "cancel_stop_after_current"; workspaceId: string }
  | { type: "stop_after_current_global" }
  | { type: "cancel_stop_after_current_global" }
  | { type: "message"; workspaceId: string; text: string }
  | { type: "get_state"; workspaceId: string }
  | { type: "restore_session"; workspaceId: string; sessionId: string; controlState?: ControlState }

/** Events broadcast from the worker to connected tabs. */
export type WorkerEvent =
  | { type: "state_change"; workspaceId: string; state: ControlState }
  | { type: "event"; workspaceId: string; event: unknown }
  | { type: "error"; workspaceId: string; error: string }
  | { type: "connected"; workspaceId: string }
  | { type: "disconnected"; workspaceId: string }
  | { type: "session_created"; workspaceId: string; sessionId: string }
  | {
      type: "session_restored"
      workspaceId: string
      sessionId: string
      controlState?: ControlState
    }
  | { type: "pending_events"; workspaceId: string; events: unknown[] }
  | { type: "streaming_state"; workspaceId: string; isStreaming: boolean }
  | { type: "stop_after_current_change"; workspaceId: string; isStoppingAfterCurrent: boolean }
  | { type: "stop_after_current_global_change"; isStoppingAfterCurrentGlobal: boolean }

/** All connected ports (for cleanup). */
export const allPorts: Set<MessagePort> = new Set()

/** Per-workspace state keyed by workspace ID (owner/repo). */
export const workspaces = new Map<string, WorkspaceState>()

/** Global flag for stop-after-current across all workspaces. */
export let isStoppingAfterCurrentGlobal = false

/** Get or create state for a workspace. */
export function getWorkspace(workspaceId: string): WorkspaceState {
  let state = workspaces.get(workspaceId)
  if (!state) {
    state = {
      controlState: "idle",
      currentSessionId: null,
      ws: null,
      reconnectTimer: null,
      pingInterval: null,
      subscribedPorts: new Set(),
      sessionCompleted: false,
      stopAfterCurrentPending: false,
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

/** Broadcast an event to ALL connected ports across all workspaces. */
function broadcastToAllPorts(event: WorkerEvent): void {
  // Create a set to avoid sending to the same port multiple times
  // (a port may be subscribed to multiple workspaces)
  const sentPorts = new Set<MessagePort>()

  for (const state of workspaces.values()) {
    state.subscribedPorts.forEach(port => {
      if (!sentPorts.has(port)) {
        try {
          port.postMessage(event)
          sentPorts.add(port)
        } catch {
          state.subscribedPorts.delete(port)
          allPorts.delete(port)
        }
      }
    })
  }
}

/** Set global stop-after-current flag and broadcast to all ports. */
function setGlobalStopAfterCurrent(value: boolean): void {
  if (isStoppingAfterCurrentGlobal !== value) {
    isStoppingAfterCurrentGlobal = value

    // Also set/clear the per-workspace flags
    for (const [workspaceId, state] of workspaces) {
      if (state.stopAfterCurrentPending !== value) {
        state.stopAfterCurrentPending = value
        broadcastToWorkspace(workspaceId, {
          type: "stop_after_current_change",
          workspaceId,
          isStoppingAfterCurrent: value,
        })
      }
    }

    broadcastToAllPorts({
      type: "stop_after_current_global_change",
      isStoppingAfterCurrentGlobal: value,
    })
  }
}

/** Check if all workspaces are idle and clear global stop flag if so. */
function checkAndClearGlobalStopIfAllIdle(): void {
  if (!isStoppingAfterCurrentGlobal) return

  // Check if any workspace is still running or paused
  for (const state of workspaces.values()) {
    if (state.controlState === "running" || state.controlState === "paused") {
      return // At least one workspace is still active
    }
  }

  // All workspaces are idle — clear global stop flag
  setGlobalStopAfterCurrent(false)
}

/** Update control state and broadcast the change. */
function setControlState(workspaceId: string, newState: ControlState): void {
  const state = getWorkspace(workspaceId)
  if (state.controlState !== newState) {
    state.controlState = newState
    broadcastToWorkspace(workspaceId, { type: "state_change", workspaceId, state: newState })

    // When transitioning to idle, check if all workspaces are now idle
    // and clear the global stop flag if so
    if (newState === "idle") {
      checkAndClearGlobalStopIfAllIdle()
    }
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
    const ws = new WebSocket(getWebSocketUrl(workspaceId))
    state.ws = ws

    ws.onopen = () => {
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

    ws.onmessage = e => {
      try {
        const raw = e.data as string
        const message = JSON.parse(raw) as Record<string, unknown>

        // Detect session completion markers in assistant text content blocks.
        // Two markers indicate the session should auto-continue:
        // 1. <promise>COMPLETE</promise> — no more tasks available
        // 2. <end_task>...</end_task> — task completed, continue to next task
        //
        // Match markers at the START (common: marker then summary) or END of text.
        // The "start of text" pattern requires the marker to be followed by newlines
        // or end-of-string to avoid false positives when the agent mentions markers
        // mid-sentence (e.g., discussing the protocol or reading source code).
        if (message.type === "event") {
          const event = message.event as Record<string, unknown> | undefined

          // Check for markers in the event content
          const checkTextForMarkers = (text: string): boolean => {
            // Check for promise complete marker
            if (
              /^\s*<promise>COMPLETE<\/promise>\s*(\n|$)/i.test(text) ||
              /<promise>COMPLETE<\/promise>\s*$/i.test(text)
            ) {
              return true
            }
            // Check for end_task marker (task completed, continue loop)
            if (
              /^\s*<end_task>[a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*<\/end_task>\s*(\n|$)/i.test(text) ||
              /<end_task>[a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*<\/end_task>\s*$/i.test(text)
            ) {
              return true
            }
            return false
          }

          // Check "assistant" events (complete messages with content blocks)
          if (event?.type === "assistant") {
            // Content blocks may be at event.message.content (Anthropic API format)
            // or event.content (normalized format)
            const msg = event.message as Record<string, unknown> | undefined
            const content = (msg?.content ?? event.content) as
              | Array<Record<string, unknown>>
              | undefined
            if (content) {
              for (const block of content) {
                if (block.type === "text" && typeof block.text === "string") {
                  if (checkTextForMarkers(block.text)) {
                    state.sessionCompleted = true
                    break
                  }
                }
              }
            }
          }

          // Check "message" events (streaming text deltas)
          // This is how markers actually arrive in practice - via streaming content
          if (event?.type === "message" && typeof event.content === "string") {
            if (checkTextForMarkers(event.content)) {
              state.sessionCompleted = true
            }
          }
        }

        if (message.type === "pong") return

        // Server sends {"type": "connected"} as an acknowledgment — not a chat event
        if (message.type === "connected") return

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
          const pendingSessionId = message.sessionId as string | undefined

          // Drop stale pending_events from a previous session. This prevents a
          // race where: (1) page loads and restores old session, (2) worker sends
          // reconnect for old session, (3) user starts a NEW session, (4) server
          // responds with pending_events for the OLD session. Without this check
          // those old events would be appended to the new session's stream.
          if (pendingSessionId && pendingSessionId !== state.currentSessionId) {
            return
          }

          // Broadcast pending_events (even if empty) - the UI needs to know
          // event restoration is complete (e.g., for newly created sessions)
          broadcastToWorkspace(workspaceId, {
            type: "pending_events",
            workspaceId,
            events: events ?? [],
          })
          return
        }

        if (message.type === "status") {
          const status = message.status as string
          // Broadcast streaming state change for UI to enable/disable input
          broadcastToWorkspace(workspaceId, {
            type: "streaming_state",
            workspaceId,
            isStreaming: status === "processing",
          })
          // Also broadcast as generic event for any listeners
          broadcastToWorkspace(workspaceId, { type: "event", workspaceId, event: message })

          // When the agent finishes processing (status transitions away from "processing"):
          //
          // 1. If stopAfterCurrentPending is set, transition to idle regardless of
          //    whether promise_complete was seen. This prevents the UI from being
          //    stuck on "Stopping after task" when the session ends without the marker.
          //
          // 2. If sessionCompleted (promise_complete was seen), auto-start a new session
          //    (the core Ralph loop).
          if (status !== "processing" && state.controlState === "running") {
            if (state.stopAfterCurrentPending) {
              // User requested stop after current — transition to idle
              state.sessionCompleted = false
              state.stopAfterCurrentPending = false
              setControlState(workspaceId, "idle")
              broadcastToWorkspace(workspaceId, {
                type: "stop_after_current_change",
                workspaceId,
                isStoppingAfterCurrent: false,
              })
            } else if (state.sessionCompleted) {
              state.sessionCompleted = false
              createOrResumeSession(workspaceId)
            }
          }
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

    ws.onclose = () => {
      // Only clean up if this is still the current WebSocket — a replacement
      // WS may have been created already (e.g. by restore_session or start)
      if (state.ws === ws) {
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
    }

    ws.onerror = () => {
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
export function handlePortMessage(message: WorkerMessage, port: MessagePort): void {
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

      // Send current stop_after_current state (if set)
      if (state.stopAfterCurrentPending) {
        port.postMessage({
          type: "stop_after_current_change",
          workspaceId: message.workspaceId,
          isStoppingAfterCurrent: true,
        } satisfies WorkerEvent)
      }

      // Send global stop_after_current state (if set)
      if (isStoppingAfterCurrentGlobal) {
        port.postMessage({
          type: "stop_after_current_global_change",
          isStoppingAfterCurrentGlobal: true,
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

    case "unsubscribe_workspace": {
      const state = workspaces.get(message.workspaceId)
      if (state) {
        state.subscribedPorts.delete(port)

        // Notify the port that it's disconnected from this workspace
        try {
          port.postMessage({
            type: "disconnected",
            workspaceId: message.workspaceId,
          } satisfies WorkerEvent)
        } catch {
          // Port may already be closed
        }

        // Disconnect if no subscribers remain — a worker with zero subscribers
        // is unreachable, so keeping connections alive creates ghost sessions
        // (especially after Vite HMR, which creates a new SharedWorker instance)
        if (state.subscribedPorts.size === 0) {
          disconnectWorkspace(message.workspaceId)
          state.controlState = "idle"
          state.currentSessionId = null
        }
      }
      break
    }

    case "start": {
      const state = getWorkspace(message.workspaceId)
      if (state.controlState === "idle") {
        state.sessionCompleted = false
        state.stopAfterCurrentPending = false
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
      // Pause immediately interrupts the agent and goes to paused state
      const state = getWorkspace(message.workspaceId)
      state.sessionCompleted = false

      // Send interrupt message to the agent-server if we have an active session
      if (state.currentSessionId && state.ws?.readyState === WebSocket.OPEN) {
        state.ws.send(
          JSON.stringify({
            type: "interrupt",
            sessionId: state.currentSessionId,
          }),
        )
      }

      setControlState(message.workspaceId, "paused")
      // Note: We don't clear currentSessionId or disconnect - this allows
      // viewing past events and sending new messages to continue the session
      break
    }

    case "resume": {
      // Resume from paused state — continue the current session
      const state = getWorkspace(message.workspaceId)
      if (state.controlState === "paused" && state.currentSessionId) {
        setControlState(message.workspaceId, "running")

        // Fetch and send the Ralph prompt to continue the session
        if (state.ws?.readyState === WebSocket.OPEN) {
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
              broadcastToWorkspace(message.workspaceId, {
                type: "error",
                workspaceId: message.workspaceId,
                error: `Failed to load Ralph prompt: ${err.message}`,
              })
            })
        }
      }
      break
    }

    case "stop_after_current": {
      // Set flag to stop after the current session completes
      const state = getWorkspace(message.workspaceId)
      if (!state.stopAfterCurrentPending) {
        state.stopAfterCurrentPending = true
        broadcastToWorkspace(message.workspaceId, {
          type: "stop_after_current_change",
          workspaceId: message.workspaceId,
          isStoppingAfterCurrent: true,
        })
      }
      break
    }

    case "cancel_stop_after_current": {
      // Clear the stop after current flag
      const state = getWorkspace(message.workspaceId)
      if (state.stopAfterCurrentPending) {
        state.stopAfterCurrentPending = false
        broadcastToWorkspace(message.workspaceId, {
          type: "stop_after_current_change",
          workspaceId: message.workspaceId,
          isStoppingAfterCurrent: false,
        })
      }
      break
    }

    case "stop_after_current_global": {
      // Set stop after current for ALL workspaces
      setGlobalStopAfterCurrent(true)
      break
    }

    case "cancel_stop_after_current_global": {
      // Clear stop after current for ALL workspaces
      setGlobalStopAfterCurrent(false)
      break
    }

    case "message": {
      const state = getWorkspace(message.workspaceId)
      if (state.controlState === "paused") {
        // Auto-resume: transition to running when user sends a message while paused
        setControlState(message.workspaceId, "running")
        sendMessageToWorkspace(message.workspaceId, message.text)
      } else if (state.controlState === "running") {
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

    case "restore_session": {
      const state = getWorkspace(message.workspaceId)
      // Only restore if workspace is idle and has no active session
      if (state.controlState === "idle" && !state.currentSessionId) {
        state.currentSessionId = message.sessionId

        // If the session was running before reload, restore that state
        if (message.controlState === "running") {
          state.controlState = message.controlState
        }

        // Send reconnect to fetch historical events
        const sendReconnect = () => {
          if (state.ws?.readyState === WebSocket.OPEN) {
            state.ws.send(
              JSON.stringify({
                type: "reconnect",
                sessionId: state.currentSessionId,
              }),
            )
            return true
          }
          return false
        }

        // Try immediately if already connected, otherwise poll until the
        // WebSocket (started by subscribe_workspace) opens. Do NOT call
        // connectWorkspace here — subscribe_workspace already initiated the
        // connection and creating a second one causes a reconnection loop
        // (the old WS's onclose clobbers state.ws).
        if (!sendReconnect()) {
          const checkAndReconnect = setInterval(() => {
            if (sendReconnect()) {
              clearInterval(checkAndReconnect)
            }
          }, 100)
          setTimeout(() => clearInterval(checkAndReconnect), 10000)
        }

        broadcastToWorkspace(message.workspaceId, {
          type: "session_restored",
          workspaceId: message.workspaceId,
          sessionId: message.sessionId,
          controlState: message.controlState,
        })
      }
      break
    }
  }
}

/** Remove a port from all workspace subscriptions. */
export function removePort(port: MessagePort): void {
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
