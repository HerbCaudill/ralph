import { useState, useEffect, useRef, useCallback } from "react"

/**
 * State of the orchestrator.
 */
export type OrchestratorState = "stopped" | "running" | "stopping"

/**
 * State of an individual worker.
 */
export type WorkerState = "idle" | "running" | "paused"

/**
 * Information about a worker's current state.
 */
export interface WorkerInfo {
  workerName: string
  state: WorkerState
  currentTaskId: string | null
}

/**
 * Session creation event payload.
 */
export interface SessionCreatedEvent {
  workerName: string
  sessionId: string
  taskId: string
}

/**
 * Options for the useWorkerOrchestrator hook.
 */
export interface UseWorkerOrchestratorOptions {
  /** Callback invoked when a new session is created by any worker. */
  onSessionCreated?: (event: SessionCreatedEvent) => void
}

/**
 * Return type of the useWorkerOrchestrator hook.
 */
export interface UseWorkerOrchestratorReturn {
  /** Current orchestrator state. */
  state: OrchestratorState
  /** Map of worker names to their current state. */
  workers: Record<string, WorkerInfo>
  /** Maximum number of workers configured. */
  maxWorkers: number
  /** Number of currently active workers. */
  activeWorkerCount: number
  /** Whether connected to the server. */
  isConnected: boolean
  /** IDs of currently active sessions (one per running worker). */
  activeSessionIds: string[]
  /** The most recently created session ID (for auto-selection). */
  latestSessionId: string | null

  // Orchestrator controls
  /** Start the orchestrator. */
  start: () => void
  /** Stop all workers immediately. */
  stop: () => void
  /** Stop after all current tasks complete. */
  stopAfterCurrent: () => void
  /** Cancel a pending stop-after-current request. */
  cancelStopAfterCurrent: () => void

  // Per-worker controls
  /** Pause a specific worker. */
  pauseWorker: (workerName: string) => void
  /** Resume a paused worker. */
  resumeWorker: (workerName: string) => void
  /** Stop a specific worker. */
  stopWorker: (workerName: string) => void
}

/**
 * WebSocket message types for orchestrator communication.
 */
type OrchestratorMessage =
  | { type: "subscribe_orchestrator"; workspaceId: string }
  | { type: "unsubscribe_orchestrator"; workspaceId: string }
  | { type: "orchestrator_start"; workspaceId: string }
  | { type: "orchestrator_stop"; workspaceId: string }
  | { type: "orchestrator_stop_after_current"; workspaceId: string }
  | { type: "orchestrator_cancel_stop"; workspaceId: string }
  | { type: "worker_pause"; workerName: string; workspaceId: string }
  | { type: "worker_resume"; workerName: string; workspaceId: string }
  | { type: "worker_stop"; workerName: string; workspaceId: string }

/**
 * Hook that manages parallel worker orchestration via WebSocket.
 *
 * This hook connects to the server's orchestrator WebSocket endpoint and provides:
 * - Real-time state updates for the orchestrator and individual workers
 * - Control actions for starting, stopping, pausing, and resuming workers
 * - Session tracking for active worker sessions
 *
 * @param workspaceId - The workspace identifier in `owner/repo` format.
 * @param options - Optional configuration including callbacks.
 * @returns Object with orchestrator state and control functions.
 */
export function useWorkerOrchestrator(
  workspaceId?: string,
  options?: UseWorkerOrchestratorOptions,
): UseWorkerOrchestratorReturn {
  const [state, setState] = useState<OrchestratorState>("stopped")
  const [workers, setWorkers] = useState<Record<string, WorkerInfo>>({})
  const [maxWorkers, setMaxWorkers] = useState(3)
  const [activeWorkerCount, setActiveWorkerCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [activeSessionIds, setActiveSessionIds] = useState<string[]>([])
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null)

  // Store callback ref to avoid dependency issues
  const onSessionCreatedRef = useRef(options?.onSessionCreated)
  useEffect(() => {
    onSessionCreatedRef.current = options?.onSessionCreated
  }, [options?.onSessionCreated])

  const wsRef = useRef<WebSocket | null>(null)
  const currentWorkspaceRef = useRef<string | undefined>(undefined)

  /** Send a message to the WebSocket server. */
  const sendMessage = useCallback((message: OrchestratorMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  /** Handle incoming WebSocket messages. */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>

      // Handle connection confirmation
      if (data.type === "connected") {
        setIsConnected(true)
        return
      }

      // Ignore messages for other workspaces
      if (data.workspaceId && data.workspaceId !== currentWorkspaceRef.current) {
        return
      }

      switch (data.type) {
        case "orchestrator_state":
          setState(data.state as OrchestratorState)
          setMaxWorkers(data.maxWorkers as number)
          setActiveWorkerCount(data.activeWorkerCount as number)
          setWorkers(data.workers as Record<string, WorkerInfo>)
          break

        case "orchestrator_state_changed":
          setState(data.state as OrchestratorState)
          break

        case "orchestrator_started":
          setState(data.state as OrchestratorState)
          break

        case "orchestrator_stopped":
          setState(data.state as OrchestratorState)
          // Clear active sessions when orchestrator stops
          setActiveSessionIds([])
          setLatestSessionId(null)
          break

        case "orchestrator_stopping":
          setState(data.state as OrchestratorState)
          break

        case "orchestrator_resumed":
          setState(data.state as OrchestratorState)
          break

        case "worker_started": {
          const workerName = data.workerName as string
          setWorkers(prev => ({
            ...prev,
            [workerName]: {
              workerName,
              state: "running",
              currentTaskId: null,
            },
          }))
          break
        }

        case "worker_stopped": {
          const workerName = data.workerName as string
          setWorkers(prev => {
            const next = { ...prev }
            delete next[workerName]
            return next
          })
          break
        }

        case "worker_paused": {
          const workerName = data.workerName as string
          setWorkers(prev => {
            if (!prev[workerName]) return prev
            return {
              ...prev,
              [workerName]: {
                ...prev[workerName],
                state: "paused",
              },
            }
          })
          break
        }

        case "worker_resumed": {
          const workerName = data.workerName as string
          setWorkers(prev => {
            if (!prev[workerName]) return prev
            return {
              ...prev,
              [workerName]: {
                ...prev[workerName],
                state: "running",
              },
            }
          })
          break
        }

        case "task_started": {
          const workerName = data.workerName as string
          const taskId = data.taskId as string
          setWorkers(prev => {
            if (!prev[workerName]) return prev
            return {
              ...prev,
              [workerName]: {
                ...prev[workerName],
                currentTaskId: taskId,
              },
            }
          })
          break
        }

        case "task_completed": {
          const workerName = data.workerName as string
          setWorkers(prev => {
            if (!prev[workerName]) return prev
            return {
              ...prev,
              [workerName]: {
                ...prev[workerName],
                currentTaskId: null,
              },
            }
          })
          break
        }

        case "session_created": {
          const sessionId = data.sessionId as string
          const workerName = data.workerName as string
          const taskId = data.taskId as string

          // Track this session as active
          setActiveSessionIds(prev => {
            if (prev.includes(sessionId)) return prev
            return [...prev, sessionId]
          })

          // Update latest session for auto-selection
          setLatestSessionId(sessionId)

          // Invoke callback if provided
          onSessionCreatedRef.current?.({ workerName, sessionId, taskId })
          break
        }

        case "orchestrator_error":
          console.error(
            "[useWorkerOrchestrator] Error:",
            data.error,
            data.workerName as string | undefined,
          )
          break
      }
    } catch {
      // Ignore malformed messages
    }
  }, [])

  /** Initialize WebSocket connection.
   * Connection deferred with setTimeout(0) so React StrictMode's synchronous
   * mount→unmount→remount cycle doesn't create a WebSocket that is immediately
   * torn down — which causes ECONNRESET on the proxy.
   */
  useEffect(() => {
    currentWorkspaceRef.current = workspaceId

    if (!workspaceId) {
      return
    }

    // Construct WebSocket URL based on current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws`

    // Defer connection to avoid ECONNRESET in React StrictMode's double-mount
    const connectTimer = setTimeout(() => {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Subscribe to orchestrator events for this workspace
        sendMessage({
          type: "subscribe_orchestrator",
          workspaceId,
        })
      }

      ws.onmessage = handleMessage

      ws.onclose = () => {
        setIsConnected(false)
      }

      ws.onerror = () => {
        setIsConnected(false)
      }
    }, 0)

    return () => {
      clearTimeout(connectTimer)
      // Unsubscribe before closing
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendMessage({
          type: "unsubscribe_orchestrator",
          workspaceId,
        })
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [workspaceId, handleMessage, sendMessage])

  // Orchestrator control actions
  const start = useCallback(() => {
    if (!workspaceId) return
    sendMessage({ type: "orchestrator_start", workspaceId })
  }, [workspaceId, sendMessage])

  const stop = useCallback(() => {
    if (!workspaceId) return
    sendMessage({ type: "orchestrator_stop", workspaceId })
  }, [workspaceId, sendMessage])

  const stopAfterCurrent = useCallback(() => {
    if (!workspaceId) return
    sendMessage({ type: "orchestrator_stop_after_current", workspaceId })
  }, [workspaceId, sendMessage])

  const cancelStopAfterCurrent = useCallback(() => {
    if (!workspaceId) return
    sendMessage({ type: "orchestrator_cancel_stop", workspaceId })
  }, [workspaceId, sendMessage])

  // Per-worker control actions
  const pauseWorker = useCallback(
    (workerName: string) => {
      if (!workspaceId) return
      sendMessage({ type: "worker_pause", workerName, workspaceId })
    },
    [workspaceId, sendMessage],
  )

  const resumeWorker = useCallback(
    (workerName: string) => {
      if (!workspaceId) return
      sendMessage({ type: "worker_resume", workerName, workspaceId })
    },
    [workspaceId, sendMessage],
  )

  const stopWorker = useCallback(
    (workerName: string) => {
      if (!workspaceId) return
      sendMessage({ type: "worker_stop", workerName, workspaceId })
    },
    [workspaceId, sendMessage],
  )

  return {
    state,
    workers,
    maxWorkers,
    activeWorkerCount,
    isConnected,
    activeSessionIds,
    latestSessionId,
    start,
    stop,
    stopAfterCurrent,
    cancelStopAfterCurrent,
    pauseWorker,
    resumeWorker,
    stopWorker,
  }
}
