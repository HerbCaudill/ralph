import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ConnectionStatus } from "../hooks/useWebSocket"
import type {
  ClosedTasksTimeFilter,
  MergeConflict,
  ChatEvent,
  RalphInstance,
  RalphStatus,
  SerializedInstance,
  Task,
  TaskChatMessage,
  TaskGroup,
  Theme,
  TokenUsage,
  ContextWindow,
  SessionInfo,
} from "@/types"
import { persistConfig } from "./persist"

/** Get the cutoff timestamp for a time filter */
export function getTimeFilterCutoff(filter: ClosedTasksTimeFilter): Date | null {
  if (filter === "all_time") return null
  const now = new Date()
  switch (filter) {
    case "past_hour":
      return new Date(now.getTime() - 60 * 60 * 1000)
    case "past_4_hours":
      return new Date(now.getTime() - 4 * 60 * 60 * 1000)
    case "past_day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case "past_week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
}

export const RALPH_STATUSES = [
  "stopped",
  "starting",
  "running",
  "pausing",
  "paused",
  "stopping",
  "stopping_after_current",
] as const

export function isRalphStatus(value: unknown): value is RalphStatus {
  return typeof value === "string" && RALPH_STATUSES.includes(value as RalphStatus)
}

// Default context window size for Claude Sonnet (200k tokens)
export const DEFAULT_CONTEXT_WINDOW_MAX = 200_000

// Default instance constants
export const DEFAULT_INSTANCE_ID = "default"
export const DEFAULT_INSTANCE_NAME = "Main"
export const DEFAULT_AGENT_NAME = "Ralph"

/**
 * Creates a new RalphInstance with default values.
 * Used when initializing the store and when creating new instances.
 */
export function createRalphInstance(
  id: string,
  name: string = DEFAULT_INSTANCE_NAME,
  agentName: string = DEFAULT_AGENT_NAME,
): RalphInstance {
  return {
    id,
    name,
    agentName,
    status: "stopped",
    events: [],
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
    session: { current: 0, total: 0 },
    worktreePath: null,
    branch: null,
    currentTaskId: null,
    createdAt: Date.now(),
    runStartedAt: null,
    mergeConflict: null,
  }
}

export interface AppState {
  // === Multi-instance state ===

  /** Map of all Ralph instances by their ID */
  instances: Map<string, RalphInstance>

  /** ID of the currently active/displayed instance */
  activeInstanceId: string

  // === Legacy flat fields (DEPRECATED - for backward compatibility) ===
  // These fields duplicate data from the active instance. They are deprecated
  // and will be removed in a future release. All consumers should use the
  // instances Map via selectors (selectRalphStatus, selectEvents, etc.).
  //
  // Migration status:
  // - Phase 1: Selectors read from instances Map (no fallback) ✓
  // - Phase 2: Actions only update instances Map ✓
  // - Phase 3: Remove these fields from AppState (pending)

  /**
   * @deprecated Use selectRalphStatus(state) instead, which reads from instances Map.
   * This flat field will be removed in a future release.
   */
  ralphStatus: RalphStatus

  /**
   * @deprecated Use selectRunStartedAt(state) instead, which reads from instances Map.
   * This flat field will be removed in a future release.
   */
  runStartedAt: number | null

  /**
   * @deprecated This field is not replicated in instances Map. Consider deriving from tasks.
   * This flat field will be removed in a future release.
   */
  initialTaskCount: number | null

  /**
   * @deprecated Use selectEvents(state) instead, which reads from instances Map.
   * This flat field will be removed in a future release.
   */
  events: ChatEvent[]

  // === Workspace state (shared across all instances) ===

  // Tasks from ralph
  tasks: Task[]

  // Current workspace path
  workspace: string | null

  // Git branch name
  branch: string | null

  // Issue prefix for this workspace (e.g., "rui")
  issuePrefix: string | null

  /**
   * @deprecated Use selectTokenUsage(state) instead, which reads from instances Map.
   * This flat field will be removed in a future release.
   */
  tokenUsage: TokenUsage

  /**
   * @deprecated Use selectContextWindow(state) instead, which reads from instances Map.
   * This flat field will be removed in a future release.
   */
  contextWindow: ContextWindow

  /**
   * @deprecated Use selectSession(state) instead, which reads from instances Map.
   * This flat field will be removed in a future release.
   */
  session: SessionInfo

  // WebSocket connection status
  connectionStatus: ConnectionStatus

  // Accent color from peacock settings (null means use default/black)
  accentColor: string | null

  // UI State - widths are stored as percentages of window width (0-100)
  sidebarWidth: number

  // Theme
  theme: Theme

  // VS Code theme persistence
  vscodeThemeId: string | null
  lastDarkThemeId: string | null
  lastLightThemeId: string | null

  // Task chat panel state
  taskChatOpen: boolean
  taskChatWidth: number // Stored as percentage of window width (0-100)
  taskChatMessages: TaskChatMessage[]
  taskChatLoading: boolean
  currentTaskChatSessionId: string | null

  // Session view state (null = show current/latest session)
  viewingSessionIndex: number | null

  // Task search filter
  taskSearchQuery: string

  // Selected task for keyboard navigation
  selectedTaskId: string | null

  // Visible task IDs (for keyboard navigation through filtered/sorted tasks)
  visibleTaskIds: string[]

  // Closed tasks time filter
  closedTimeFilter: ClosedTasksTimeFilter

  // Tool output visibility (global setting for all ToolUseCards)
  showToolOutput: boolean

  // Search input visibility (hidden by default, shown on Cmd+F)
  isSearchVisible: boolean

  // Hotkeys dialog visibility
  hotkeysDialogOpen: boolean

  // Task list collapsed states
  statusCollapsedState: Record<TaskGroup, boolean>
  parentCollapsedState: Record<string, boolean>

  // Input draft states (persisted to avoid losing unsent messages)
  taskInputDraft: string
  taskChatInputDraft: string

  // Comment drafts per task (taskId -> draft text)
  commentDrafts: Record<string, string>

  // Task chat events (unified array like EventStream's events[])
  taskChatEvents: ChatEvent[]

  // Reconnection state (for auto-resuming when reconnecting mid-session)
  /** Whether Ralph was running when the connection was lost */
  wasRunningBeforeDisconnect: boolean

  // Initial sync tracking (to prevent auto-start race conditions on page reload)
  /** Whether we've received the initial WebSocket sync (instances:list message) */
  hasInitialSync: boolean

  // IndexedDB persistence error state
  /** Error information when IndexedDB writes fail persistently */
  persistenceError: {
    message: string
    failedCount: number
  } | null
}

// Store Actions

export interface AppActions {
  // Ralph status
  setRalphStatus: (status: RalphStatus) => void

  // Events
  addEvent: (event: ChatEvent) => void
  /** Merge events with existing events, deduplicating by ID. Used for reconnection sync. */
  setEvents: (events: ChatEvent[]) => void
  /** Replace all events (no merge). Used for workspace switching. */
  replaceEvents: (events: ChatEvent[]) => void
  clearEvents: () => void

  // Tasks
  setTasks: (tasks: Task[]) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  clearTasks: () => void
  /** Refresh tasks from API (debounced to coalesce rapid mutation events) */
  refreshTasks: () => void

  // Workspace
  setWorkspace: (workspace: string | null) => void
  /** Clear all workspace-specific data (events, tasks, token usage, etc.) when switching workspaces */
  clearWorkspaceData: () => void

  // Accent color
  setAccentColor: (color: string | null) => void

  // Branch
  setBranch: (branch: string | null) => void

  // Issue prefix
  setIssuePrefix: (prefix: string | null) => void

  // Token usage
  setTokenUsage: (usage: TokenUsage) => void
  addTokenUsage: (usage: TokenUsage) => void

  // Context window
  setContextWindow: (contextWindow: ContextWindow) => void
  updateContextWindowUsed: (used: number) => void

  // Session
  setSession: (session: SessionInfo) => void
  /** Reset session stats (token usage, context window) when a new session starts */
  resetSessionStats: () => void

  // Connection
  setConnectionStatus: (status: ConnectionStatus) => void

  // UI State
  setSidebarWidth: (width: number) => void

  // Theme
  setTheme: (theme: Theme) => void
  setVSCodeThemeId: (themeId: string | null) => void
  setLastDarkThemeId: (themeId: string | null) => void
  setLastLightThemeId: (themeId: string | null) => void

  // Task chat panel
  setTaskChatOpen: (open: boolean) => void
  toggleTaskChat: () => void
  setTaskChatWidth: (width: number) => void
  addTaskChatMessage: (message: TaskChatMessage) => void
  removeTaskChatMessage: (id: string) => void
  clearTaskChatMessages: () => void
  setTaskChatLoading: (loading: boolean) => void
  setCurrentTaskChatSessionId: (sessionId: string | null) => void

  // Task chat events (unified array)
  addTaskChatEvent: (event: ChatEvent) => void
  clearTaskChatEvents: () => void

  // Session view
  setViewingSessionIndex: (index: number | null) => void
  goToPreviousSession: () => void
  goToNextSession: () => void
  goToLatestSession: () => void

  // Task search
  setTaskSearchQuery: (query: string) => void
  clearTaskSearchQuery: () => void

  // Task selection (for keyboard navigation)
  setSelectedTaskId: (id: string | null) => void
  clearSelectedTaskId: () => void
  setVisibleTaskIds: (ids: string[]) => void

  // Closed time filter
  setClosedTimeFilter: (filter: ClosedTasksTimeFilter) => void

  // Tool output visibility
  setShowToolOutput: (show: boolean) => void
  toggleToolOutput: () => void

  // Search visibility
  setSearchVisible: (visible: boolean) => void
  showSearch: () => void
  hideSearch: () => void

  // Hotkeys dialog
  setHotkeysDialogOpen: (open: boolean) => void
  openHotkeysDialog: () => void
  closeHotkeysDialog: () => void

  // Task list collapsed states
  setStatusCollapsedState: (state: Record<TaskGroup, boolean>) => void
  toggleStatusGroup: (group: TaskGroup) => void
  setParentCollapsedState: (state: Record<string, boolean>) => void
  toggleParentGroup: (parentId: string) => void

  // Input draft states
  setTaskInputDraft: (draft: string) => void
  setTaskChatInputDraft: (draft: string) => void

  // Comment drafts per task
  setCommentDraft: (taskId: string, draft: string) => void
  clearCommentDraft: (taskId: string) => void

  // Reconnection state (for auto-resuming when reconnecting mid-session)
  /** Mark that Ralph was running before disconnect (called when connection is lost) */
  markRunningBeforeDisconnect: () => void
  /** Clear the running-before-disconnect flag */
  clearRunningBeforeDisconnect: () => void

  // Initial sync tracking
  /** Mark that we've received the initial WebSocket sync */
  setHasInitialSync: (hasSync: boolean) => void

  // IndexedDB persistence error
  /** Set persistence error state (called when IndexedDB writes fail) */
  setPersistenceError: (error: { message: string; failedCount: number } | null) => void
  /** Clear persistence error state (called when user dismisses or retries) */
  clearPersistenceError: () => void

  // Active instance
  setActiveInstanceId: (instanceId: string) => void

  // Instance management
  /** Create a new Ralph instance and add it to the instances Map */
  createInstance: (id: string, name?: string, agentName?: string) => void
  /** Remove an instance from the instances Map (cannot remove the active instance) */
  removeInstance: (instanceId: string) => void
  /** Clean up runtime state for an instance when it exits/stops (events, token usage, etc.) */
  cleanupInstance: (instanceId: string) => void
  /** Hydrate instances from server data (on WebSocket connect) */
  hydrateInstances: (serverInstances: SerializedInstance[]) => void

  // Per-instance actions (for routing WebSocket messages to specific instances)
  /** Add an event to a specific instance by ID */
  addEventForInstance: (instanceId: string, event: ChatEvent) => void
  /** Merge events for a specific instance by ID, deduplicating by event ID. Used for reconnection sync. */
  setEventsForInstance: (instanceId: string, events: ChatEvent[]) => void
  /** Replace all events for a specific instance (no merge). Used for workspace switching. */
  replaceEventsForInstance: (instanceId: string, events: ChatEvent[]) => void
  /** Set status for a specific instance by ID */
  setStatusForInstance: (instanceId: string, status: RalphStatus) => void
  /** Add token usage for a specific instance by ID */
  addTokenUsageForInstance: (instanceId: string, usage: TokenUsage) => void
  /** Update context window usage for a specific instance by ID */
  updateContextWindowUsedForInstance: (instanceId: string, used: number) => void
  /** Set session for a specific instance by ID */
  setSessionForInstance: (instanceId: string, session: SessionInfo) => void
  /** Reset session stats for a specific instance by ID (called when new session starts) */
  resetSessionStatsForInstance: (instanceId: string) => void
  /** Set merge conflict for a specific instance by ID */
  setMergeConflictForInstance: (instanceId: string, conflict: MergeConflict | null) => void
  /** Clear merge conflict for a specific instance by ID */
  clearMergeConflictForInstance: (instanceId: string) => void

  // Reset
  reset: () => void
}

/**
 * Checks if an event is a session boundary (ralph_session_start).
 * Session boundaries are emitted by the Ralph CLI at the start of each round.
 *
 * This is the single authoritative source for session boundaries. Events include
 * rich metadata: sessionId (UUID), session number, taskId, and repo name.
 *
 * Legacy note: For backward compatibility with older persisted events, we also
 * check for system/init events as a fallback. New sessions only emit ralph_session_start.
 */
export function isSessionBoundary(event: ChatEvent): boolean {
  // Primary: ralph_session_start from CLI
  if (event.type === "ralph_session_start") {
    return true
  }
  // Legacy fallback: system/init (for backward compatibility with older persisted events)
  if (event.type === "system" && (event as any).subtype === "init") {
    return true
  }
  return false
}

/**
 * Gets the indices of session boundaries in the events array.
 * Returns an array of indices where each session starts.
 *
 * Session boundaries are ralph_session_start events emitted by the CLI.
 * For backward compatibility with older persisted events, falls back to
 * system/init events if no ralph_session_start events exist.
 *
 * Note: When both types exist, only ralph_session_start is used to prevent
 * double-counting (legacy system/init events may co-exist in older data).
 */
export function getSessionBoundaries(events: ChatEvent[]): number[] {
  const primaryBoundaries: number[] = []
  const fallbackBoundaries: number[] = []

  events.forEach((event, index) => {
    if (event.type === "ralph_session_start") {
      primaryBoundaries.push(index)
    } else if (event.type === "system" && (event as any).subtype === "init") {
      fallbackBoundaries.push(index)
    }
  })

  // Use primary boundaries if available, otherwise fall back to system/init for legacy data
  return primaryBoundaries.length > 0 ? primaryBoundaries : fallbackBoundaries
}

/**  Counts the total number of sessions in the events array. */
export function countSessions(events: ChatEvent[]): number {
  return getSessionBoundaries(events).length
}

/**
 * Gets events for a specific session.
 * Returns events from the session boundary up to (but not including) the next boundary.
 * If sessionIndex is null or out of bounds, returns all events.
 */
export function getEventsForSession(events: ChatEvent[], sessionIndex: number | null): ChatEvent[] {
  if (sessionIndex === null) {
    // Return all events from the latest session
    const boundaries = getSessionBoundaries(events)
    if (boundaries.length === 0) return events
    const lastBoundary = boundaries[boundaries.length - 1]
    return events.slice(lastBoundary)
  }

  const boundaries = getSessionBoundaries(events)
  if (boundaries.length === 0 || sessionIndex < 0 || sessionIndex >= boundaries.length) {
    return events
  }

  const startIndex = boundaries[sessionIndex]
  const endIndex = boundaries[sessionIndex + 1] ?? events.length
  return events.slice(startIndex, endIndex)
}

/**
 * Extracts task ID from session events.
 * Looks for ralph_task_started events emitted by the CLI.
 * Returns the task ID if found, null otherwise.
 *
 * Note: Task titles should be looked up from beads, not cached in events.
 */
export function getTaskFromSessionEvents(
  /** Events from a session */
  events: ChatEvent[],
): string | null {
  for (const event of events) {
    if (event.type === "ralph_task_started") {
      const taskId = (event as { taskId?: string }).taskId
      if (taskId) {
        return taskId
      }
    }
  }
  return null
}

/**
 * Gets task IDs for all sessions.
 * Returns an array where each element corresponds to a session index.
 * Each element contains the task ID for that session (or null if no task).
 *
 * Note: Task titles should be looked up from beads using the task ID.
 */
export function getSessionTaskIds(
  /** Events from all sessions */
  events: ChatEvent[],
): (string | null)[] {
  const boundaries = getSessionBoundaries(events)
  if (boundaries.length === 0) return []

  return boundaries.map((startIndex, i) => {
    const endIndex = boundaries[i + 1] ?? events.length
    const sessionEvents = events.slice(startIndex, endIndex)
    return getTaskFromSessionEvents(sessionEvents)
  })
}

// Panel widths are stored as percentages of window width (0-100)
// This ensures consistent layout proportions across different screen sizes
const defaultSidebarWidthPercent = 20 // ~320px on 1600px screen
const defaultTaskChatWidthPercent = 25 // ~400px on 1600px screen

// Task chat events batching configuration
// Events are collected over a short window and then applied in a single state update
// Using 16ms (~one animation frame) to reduce perceived streaming latency while still
// batching rapid-fire SDK events to prevent excessive re-renders
const TASK_CHAT_EVENTS_BATCH_INTERVAL_MS = 16

// Batching state (module-level for singleton behavior)
let taskChatEventsBatch: ChatEvent[] = []
let taskChatEventsBatchTimeout: ReturnType<typeof setTimeout> | null = null

// Task refresh debouncing configuration
// Multiple rapid mutation events are coalesced into a single API call
// Lower value = faster UI updates, higher value = better batching for bulk operations
const TASK_REFRESH_DEBOUNCE_MS = 50
let taskRefreshDebounceTimeout: ReturnType<typeof setTimeout> | null = null
let taskRefreshPending = false

/**
 * Clear any pending task refresh debounce.
 * Used primarily in tests to prevent cross-test interference.
 */
export function clearTaskRefreshDebounce(): void {
  taskRefreshPending = false
  if (taskRefreshDebounceTimeout !== null) {
    clearTimeout(taskRefreshDebounceTimeout)
    taskRefreshDebounceTimeout = null
  }
}

/**
 * Flush any pending batched task chat events to the store.
 * Called automatically after the batch interval, or can be called manually.
 */
function flushTaskChatEventsBatch(): void {
  // Clear timeout first to prevent race conditions
  if (taskChatEventsBatchTimeout !== null) {
    clearTimeout(taskChatEventsBatchTimeout)
    taskChatEventsBatchTimeout = null
  }

  // Early exit if nothing to flush
  if (taskChatEventsBatch.length === 0) return

  // Capture and clear batch atomically
  const eventsToAdd = taskChatEventsBatch
  taskChatEventsBatch = []

  // Apply all batched events in a single state update
  useAppStore.setState(state => ({
    taskChatEvents: [...state.taskChatEvents, ...eventsToAdd],
  }))
}

/**
 * Merge incoming events with existing events, deduplicating by event ID.
 * Events with `id` are deduped; events without `id` are always appended.
 * Maintains chronological order by timestamp.
 *
 * This prevents race conditions between `connected` (setEvents) and
 * `pending_events` (addEvent) messages during WebSocket reconnection.
 */
function mergeEventsById(existingEvents: ChatEvent[], incomingEvents: ChatEvent[]): ChatEvent[] {
  // Build a map of existing events by ID for fast lookup
  const seenIds = new Set<string>()
  for (const event of existingEvents) {
    if (event.id) {
      seenIds.add(event.id)
    }
  }

  // Filter incoming events to exclude duplicates (by ID)
  const newEvents: ChatEvent[] = []
  for (const event of incomingEvents) {
    if (event.id) {
      if (seenIds.has(event.id)) {
        // Skip duplicate
        continue
      }
      seenIds.add(event.id)
    }
    newEvents.push(event)
  }

  // Merge and sort by timestamp to maintain chronological order
  const merged = [...existingEvents, ...newEvents]
  merged.sort((a, b) => a.timestamp - b.timestamp)
  return merged
}

const initialState: AppState = {
  // Multi-instance state - create default instance inline
  instances: new Map([
    [
      DEFAULT_INSTANCE_ID,
      createRalphInstance(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_NAME, DEFAULT_AGENT_NAME),
    ],
  ]),
  activeInstanceId: DEFAULT_INSTANCE_ID,

  // Legacy flat fields (delegate to active instance)
  ralphStatus: "stopped",
  runStartedAt: null,
  initialTaskCount: null,
  events: [],

  // Workspace state
  tasks: [],
  workspace: null,
  branch: null,
  issuePrefix: null,
  tokenUsage: { input: 0, output: 0 },
  contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
  session: { current: 0, total: 0 },
  connectionStatus: "disconnected",
  accentColor: null,
  sidebarWidth: defaultSidebarWidthPercent,
  theme: "system",
  vscodeThemeId: null,
  lastDarkThemeId: null,
  lastLightThemeId: null,
  taskChatOpen: true,
  taskChatWidth: defaultTaskChatWidthPercent,
  taskChatMessages: [],
  taskChatLoading: false,
  currentTaskChatSessionId: null,
  viewingSessionIndex: null,
  taskSearchQuery: "",
  selectedTaskId: null,
  visibleTaskIds: [],
  closedTimeFilter: "past_day",
  showToolOutput: false,
  isSearchVisible: false,
  hotkeysDialogOpen: false,
  wasRunningBeforeDisconnect: false,
  hasInitialSync: false,
  persistenceError: null,
  taskChatEvents: [],
  statusCollapsedState: {
    open: false,
    deferred: true,
    closed: true,
  },
  parentCollapsedState: {},
  taskInputDraft: "",
  taskChatInputDraft: "",
  commentDrafts: {},
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    set => ({
      ...initialState,

      // Ralph status
      setRalphStatus: status =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot set status for non-existent active instance`)
            return state
          }

          const now = Date.now()
          const isTransitioningToRunning =
            status === "running" && activeInstance.status !== "running"
          const isStopping = status === "stopped"

          // Calculate new runStartedAt
          const newRunStartedAt =
            isTransitioningToRunning ? now
            : isStopping ? null
            : activeInstance.runStartedAt

          // Calculate new initialTaskCount (workspace-level state, kept in flat field for now)
          const newInitialTaskCount =
            isTransitioningToRunning ? state.tasks.length
            : isStopping ? null
            : state.initialTaskCount

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            status,
            runStartedAt: newRunStartedAt,
          })

          return {
            initialTaskCount: newInitialTaskCount,
            instances: updatedInstances,
          }
        }),

      // Events
      addEvent: event =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot add event to non-existent active instance`)
            return state
          }

          // Deduplicate by event ID to prevent race conditions between
          // connected and pending_events messages during reconnection
          const newEvents = mergeEventsById(activeInstance.events, [event])

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            events: newEvents,
          })

          return {
            instances: updatedInstances,
          }
        }),

      setEvents: events =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot set events for non-existent active instance`)
            return state
          }

          // Merge incoming events with existing, deduplicating by ID.
          // This handles the race condition where pending_events may have arrived
          // before the connected message, or vice versa.
          const mergedEvents = mergeEventsById(activeInstance.events, events)

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            events: mergedEvents,
          })

          return {
            instances: updatedInstances,
          }
        }),

      replaceEvents: events =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot replace events for non-existent active instance`)
            return state
          }

          // Replace all events (no merge). Used for workspace switching where
          // we want to completely replace events from the previous workspace.
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            events,
          })

          return {
            instances: updatedInstances,
          }
        }),

      clearEvents: () =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot clear events for non-existent active instance`)
            return state
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            events: [],
          })

          return {
            instances: updatedInstances,
          }
        }),

      // Tasks
      setTasks: tasks => set({ tasks }),

      updateTask: (id, updates) =>
        set(state => ({
          tasks: state.tasks.map(task => (task.id === id ? { ...task, ...updates } : task)),
        })),

      removeTask: id =>
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
        })),

      clearTasks: () => set({ tasks: [] }),

      refreshTasks: () => {
        // Debounce task refresh to coalesce multiple rapid mutation events
        // This prevents hammering the API when many tasks are modified at once
        taskRefreshPending = true

        if (taskRefreshDebounceTimeout !== null) {
          // Already have a pending refresh scheduled, it will pick up this request
          return
        }

        taskRefreshDebounceTimeout = setTimeout(async () => {
          taskRefreshDebounceTimeout = null
          if (!taskRefreshPending) return

          taskRefreshPending = false
          try {
            const response = await fetch("/api/tasks?all=true")
            const data = (await response.json()) as { ok: boolean; issues?: Task[] }
            if (data.ok && data.issues) {
              set({ tasks: data.issues })
            }
          } catch (err) {
            console.error("Failed to refresh tasks:", err)
          }
        }, TASK_REFRESH_DEBOUNCE_MS)
      },

      // Workspace
      setWorkspace: workspace => set({ workspace }),
      clearWorkspaceData: () => {
        // Clear any pending task chat events batch
        taskChatEventsBatch = []
        if (taskChatEventsBatchTimeout !== null) {
          clearTimeout(taskChatEventsBatchTimeout)
          taskChatEventsBatchTimeout = null
        }
        // Clear any pending task refresh
        taskRefreshPending = false
        if (taskRefreshDebounceTimeout !== null) {
          clearTimeout(taskRefreshDebounceTimeout)
          taskRefreshDebounceTimeout = null
        }
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            // Still clear workspace-level state even if no active instance
            return {
              tasks: [],
              viewingSessionIndex: null,
              initialTaskCount: null,
              taskChatMessages: [],
              taskChatLoading: false,
              taskChatEvents: [],
            }
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
            session: { current: 0, total: 0 },
            runStartedAt: null,
            status: "stopped",
          })

          return {
            // Clear tasks immediately to avoid showing stale data
            tasks: [],
            // Clear session view state
            viewingSessionIndex: null,
            // Reset workspace-level state
            initialTaskCount: null,
            // Clear task chat messages and events
            taskChatMessages: [],
            taskChatLoading: false,
            taskChatEvents: [],
            // Updated instances Map
            instances: updatedInstances,
          }
        })
      },

      // Accent color
      setAccentColor: color => set({ accentColor: color }),

      // Branch
      setBranch: branch => set({ branch }),

      // Issue prefix
      setIssuePrefix: prefix => set({ issuePrefix: prefix }),

      // Token usage
      setTokenUsage: usage =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot set token usage for non-existent active instance`)
            return state
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            tokenUsage: usage,
          })

          return {
            instances: updatedInstances,
          }
        }),
      addTokenUsage: usage =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot add token usage to non-existent active instance`)
            return state
          }

          const newTokenUsage = {
            input: activeInstance.tokenUsage.input + usage.input,
            output: activeInstance.tokenUsage.output + usage.output,
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            tokenUsage: newTokenUsage,
          })

          return {
            instances: updatedInstances,
          }
        }),

      // Context window
      setContextWindow: contextWindow =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot set context window for non-existent active instance`)
            return state
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            contextWindow,
          })

          return {
            instances: updatedInstances,
          }
        }),
      updateContextWindowUsed: used =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot update context window for non-existent active instance`)
            return state
          }

          const newContextWindow = { ...activeInstance.contextWindow, used }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            contextWindow: newContextWindow,
          })

          return {
            instances: updatedInstances,
          }
        }),

      // Session
      setSession: session =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot set session for non-existent active instance`)
            return state
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            session,
          })

          return {
            instances: updatedInstances,
          }
        }),

      resetSessionStats: () =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          if (!activeInstance) {
            console.warn(`[store] Cannot reset session stats for non-existent active instance`)
            return state
          }

          // Update active instance in the instances Map only
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(state.activeInstanceId, {
            ...activeInstance,
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
            session: { current: 0, total: 0 },
          })

          return {
            instances: updatedInstances,
          }
        }),

      // Connection
      setConnectionStatus: status =>
        set(state => ({
          connectionStatus: status,
          // Reset initial sync flag when disconnected (will be set again on next instances:list message)
          hasInitialSync: status === "disconnected" ? false : state.hasInitialSync,
        })),

      // UI State
      setSidebarWidth: width => set({ sidebarWidth: width }),

      // Theme
      setTheme: theme => set({ theme }),
      setVSCodeThemeId: themeId => set({ vscodeThemeId: themeId }),
      setLastDarkThemeId: themeId => set({ lastDarkThemeId: themeId }),
      setLastLightThemeId: themeId => set({ lastLightThemeId: themeId }),

      // Task chat panel
      setTaskChatOpen: open => set({ taskChatOpen: open }),
      toggleTaskChat: () => set(state => ({ taskChatOpen: !state.taskChatOpen })),
      setTaskChatWidth: width => set({ taskChatWidth: width }),
      addTaskChatMessage: message =>
        set(state => ({
          taskChatMessages: [...state.taskChatMessages, message],
        })),
      removeTaskChatMessage: id =>
        set(state => ({
          taskChatMessages: state.taskChatMessages.filter(m => m.id !== id),
        })),
      clearTaskChatMessages: () => {
        // Clear any pending batch
        taskChatEventsBatch = []
        if (taskChatEventsBatchTimeout !== null) {
          clearTimeout(taskChatEventsBatchTimeout)
          taskChatEventsBatchTimeout = null
        }
        set({ taskChatMessages: [], taskChatEvents: [] })
      },
      setTaskChatLoading: loading => set({ taskChatLoading: loading }),
      setCurrentTaskChatSessionId: sessionId => set({ currentTaskChatSessionId: sessionId }),

      // Task chat events (unified array like EventStream)
      // Uses batching to reduce re-renders during rapid WebSocket events
      addTaskChatEvent: event => {
        // Add to batch instead of immediately updating state
        taskChatEventsBatch.push(event)

        // Schedule flush if not already scheduled
        if (taskChatEventsBatchTimeout === null) {
          taskChatEventsBatchTimeout = setTimeout(
            flushTaskChatEventsBatch,
            TASK_CHAT_EVENTS_BATCH_INTERVAL_MS,
          )
        }
      },
      clearTaskChatEvents: () => {
        // Clear any pending batch
        taskChatEventsBatch = []
        if (taskChatEventsBatchTimeout !== null) {
          clearTimeout(taskChatEventsBatchTimeout)
          taskChatEventsBatchTimeout = null
        }
        set({ taskChatEvents: [] })
      },

      // Session view
      setViewingSessionIndex: index => set({ viewingSessionIndex: index }),
      goToPreviousSession: () =>
        set(state => {
          // Read events from active instance (single source of truth)
          const activeInstance = state.instances.get(state.activeInstanceId)
          const events = activeInstance?.events ?? []
          const totalSessions = countSessions(events)
          if (totalSessions === 0) return state

          // If viewing latest (null), go to second-to-last session
          if (state.viewingSessionIndex === null) {
            const newIndex = totalSessions > 1 ? totalSessions - 2 : 0
            return { viewingSessionIndex: newIndex }
          }

          // If already at first session, stay there
          if (state.viewingSessionIndex <= 0) return state

          return { viewingSessionIndex: state.viewingSessionIndex - 1 }
        }),
      goToNextSession: () =>
        set(state => {
          // Read events from active instance (single source of truth)
          const activeInstance = state.instances.get(state.activeInstanceId)
          const events = activeInstance?.events ?? []
          const totalSessions = countSessions(events)
          if (totalSessions === 0) return state

          // If already viewing latest, stay there
          if (state.viewingSessionIndex === null) return state

          // If at last session, switch to latest (null)
          if (state.viewingSessionIndex >= totalSessions - 1) {
            return { viewingSessionIndex: null }
          }

          return { viewingSessionIndex: state.viewingSessionIndex + 1 }
        }),
      goToLatestSession: () => set({ viewingSessionIndex: null }),

      // Task search
      setTaskSearchQuery: query => set({ taskSearchQuery: query }),
      clearTaskSearchQuery: () => set({ taskSearchQuery: "" }),

      // Task selection (for keyboard navigation)
      setSelectedTaskId: id => set({ selectedTaskId: id }),
      clearSelectedTaskId: () => set({ selectedTaskId: null }),
      setVisibleTaskIds: ids => set({ visibleTaskIds: ids }),

      // Closed time filter
      setClosedTimeFilter: filter => set({ closedTimeFilter: filter }),

      // Tool output visibility
      setShowToolOutput: show => set({ showToolOutput: show }),
      toggleToolOutput: () => set(state => ({ showToolOutput: !state.showToolOutput })),

      // Search visibility
      setSearchVisible: visible => set({ isSearchVisible: visible }),
      showSearch: () => set({ isSearchVisible: true }),
      hideSearch: () => set({ isSearchVisible: false, taskSearchQuery: "" }),

      // Hotkeys dialog
      setHotkeysDialogOpen: open => set({ hotkeysDialogOpen: open }),
      openHotkeysDialog: () => set({ hotkeysDialogOpen: true }),
      closeHotkeysDialog: () => set({ hotkeysDialogOpen: false }),

      // Task list collapsed states
      setStatusCollapsedState: state => set({ statusCollapsedState: state }),
      toggleStatusGroup: group =>
        set(state => ({
          statusCollapsedState: {
            ...state.statusCollapsedState,
            [group]: !state.statusCollapsedState[group],
          },
        })),
      setParentCollapsedState: state => set({ parentCollapsedState: state }),
      toggleParentGroup: parentId =>
        set(state => ({
          parentCollapsedState: {
            ...state.parentCollapsedState,
            [parentId]: !state.parentCollapsedState[parentId],
          },
        })),

      // Input draft states
      setTaskInputDraft: draft => set({ taskInputDraft: draft }),
      setTaskChatInputDraft: draft => set({ taskChatInputDraft: draft }),

      // Comment drafts per task
      setCommentDraft: (taskId, draft) =>
        set(state => {
          if (!draft) {
            // Remove the draft if empty
            const { [taskId]: _, ...rest } = state.commentDrafts
            return { commentDrafts: rest }
          }
          return {
            commentDrafts: {
              ...state.commentDrafts,
              [taskId]: draft,
            },
          }
        }),
      clearCommentDraft: taskId =>
        set(state => {
          const { [taskId]: _, ...rest } = state.commentDrafts
          return { commentDrafts: rest }
        }),

      // Reconnection state (for auto-resuming when reconnecting mid-session)
      markRunningBeforeDisconnect: () =>
        set(state => {
          const activeInstance = state.instances.get(state.activeInstanceId)
          const currentStatus = activeInstance?.status ?? "stopped"
          return {
            wasRunningBeforeDisconnect: currentStatus === "running" || currentStatus === "paused",
          }
        }),
      clearRunningBeforeDisconnect: () => set({ wasRunningBeforeDisconnect: false }),

      // Initial sync tracking
      setHasInitialSync: hasSync => set({ hasInitialSync: hasSync }),

      // IndexedDB persistence error
      setPersistenceError: error => set({ persistenceError: error }),
      clearPersistenceError: () => set({ persistenceError: null }),

      // Active instance
      setActiveInstanceId: instanceId =>
        set(state => {
          // Only switch if the instance exists
          if (!state.instances.has(instanceId)) {
            console.warn(`[store] Cannot switch to non-existent instance: ${instanceId}`)
            return state
          }

          // If already active, no change needed
          if (state.activeInstanceId === instanceId) {
            return state
          }

          return {
            activeInstanceId: instanceId,
            // Reset session view when switching instances
            viewingSessionIndex: null,
          }
        }),

      // Instance management
      createInstance: (id, name, agentName) =>
        set(state => {
          // Don't create if instance with this ID already exists
          if (state.instances.has(id)) {
            console.warn(`[store] Instance with id "${id}" already exists`)
            return state
          }

          const newInstance = createRalphInstance(
            id,
            name ?? DEFAULT_INSTANCE_NAME,
            agentName ?? DEFAULT_AGENT_NAME,
          )
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(id, newInstance)

          // Auto-select the newly created instance
          return {
            instances: updatedInstances,
            activeInstanceId: id,
            // Reset session view when switching instances
            viewingSessionIndex: null,
          }
        }),

      removeInstance: instanceId =>
        set(state => {
          // Don't allow removing the active instance
          if (state.activeInstanceId === instanceId) {
            console.warn(`[store] Cannot remove the active instance: ${instanceId}`)
            return state
          }

          // Don't remove if instance doesn't exist
          if (!state.instances.has(instanceId)) {
            console.warn(`[store] Cannot remove non-existent instance: ${instanceId}`)
            return state
          }

          // Don't allow removing if it's the last instance
          if (state.instances.size <= 1) {
            console.warn(`[store] Cannot remove the last instance`)
            return state
          }

          const updatedInstances = new Map(state.instances)
          updatedInstances.delete(instanceId)

          return {
            instances: updatedInstances,
          }
        }),

      cleanupInstance: instanceId =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot cleanup non-existent instance: ${instanceId}`)
            return state
          }

          // Reset instance runtime state while preserving identity
          const cleanedInstance: RalphInstance = {
            ...instance,
            status: "stopped",
            events: [],
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
            session: { current: 0, total: 0 },
            runStartedAt: null,
            currentTaskId: null,
            mergeConflict: null,
          }

          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, cleanedInstance)

          // If cleaning up the active instance, also reset workspace-level state
          if (state.activeInstanceId === instanceId) {
            return {
              instances: updatedInstances,
              initialTaskCount: null,
              viewingSessionIndex: null,
            }
          }

          return {
            instances: updatedInstances,
          }
        }),

      hydrateInstances: serverInstances =>
        set(state => {
          if (!Array.isArray(serverInstances) || serverInstances.length === 0) {
            return state
          }

          const updatedInstances = new Map(state.instances)

          for (const serverInstance of serverInstances) {
            const existing = updatedInstances.get(serverInstance.id)

            if (existing) {
              // Update existing instance with server metadata, preserving runtime state
              const updated: RalphInstance = {
                ...existing,
                name: serverInstance.name,
                agentName: serverInstance.agentName,
                worktreePath: serverInstance.worktreePath,
                branch: serverInstance.branch,
                createdAt: serverInstance.createdAt,
                currentTaskId: serverInstance.currentTaskId,
                status: serverInstance.status,
                mergeConflict: serverInstance.mergeConflict,
              }
              updatedInstances.set(serverInstance.id, updated)
            } else {
              // Create new instance from server data
              const newInstance: RalphInstance = {
                id: serverInstance.id,
                name: serverInstance.name,
                agentName: serverInstance.agentName,
                status: serverInstance.status,
                events: [],
                tokenUsage: { input: 0, output: 0 },
                contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
                session: { current: 0, total: 0 },
                worktreePath: serverInstance.worktreePath,
                branch: serverInstance.branch,
                currentTaskId: serverInstance.currentTaskId,
                createdAt: serverInstance.createdAt,
                runStartedAt: null,
                mergeConflict: serverInstance.mergeConflict,
              }
              updatedInstances.set(serverInstance.id, newInstance)
            }
          }

          // If current active instance is still valid, keep it; otherwise switch to first server instance
          const activeInstanceId =
            updatedInstances.has(state.activeInstanceId) ?
              state.activeInstanceId
            : (serverInstances[0]?.id ?? state.activeInstanceId)

          return {
            instances: updatedInstances,
            activeInstanceId,
            // Mark that we've received the initial sync (prevents auto-start race condition on page reload)
            hasInitialSync: true,
          }
        }),

      // Per-instance actions (for routing WebSocket messages to specific instances)
      addEventForInstance: (instanceId, event) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot add event to non-existent instance: ${instanceId}`)
            return state
          }

          // Deduplicate by event ID to prevent race conditions during reconnection
          const newEvents = mergeEventsById(instance.events, [event])
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, events: newEvents })

          return { instances: updatedInstances }
        }),

      setEventsForInstance: (instanceId, events) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot set events for non-existent instance: ${instanceId}`)
            return state
          }

          // Merge incoming events with existing, deduplicating by ID
          const mergedEvents = mergeEventsById(instance.events, events)
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, events: mergedEvents })

          return { instances: updatedInstances }
        }),

      replaceEventsForInstance: (instanceId, events) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot replace events for non-existent instance: ${instanceId}`)
            return state
          }

          // Replace all events (no merge). Used for workspace switching.
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, events })

          return { instances: updatedInstances }
        }),

      setStatusForInstance: (instanceId, status) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot set status for non-existent instance: ${instanceId}`)
            return state
          }

          const now = Date.now()
          const isTransitioningToRunning = status === "running" && instance.status !== "running"
          const isStopping = status === "stopped"

          // Calculate new runStartedAt
          const newRunStartedAt =
            isTransitioningToRunning ? now
            : isStopping ? null
            : instance.runStartedAt

          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, {
            ...instance,
            status,
            runStartedAt: newRunStartedAt,
          })

          // If this is the active instance, also update workspace-level state
          if (state.activeInstanceId === instanceId) {
            const newInitialTaskCount =
              isTransitioningToRunning ? state.tasks.length
              : isStopping ? null
              : state.initialTaskCount

            return {
              instances: updatedInstances,
              initialTaskCount: newInitialTaskCount,
            }
          }

          return { instances: updatedInstances }
        }),

      addTokenUsageForInstance: (instanceId, usage) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot add token usage to non-existent instance: ${instanceId}`)
            return state
          }

          const newTokenUsage = {
            input: instance.tokenUsage.input + usage.input,
            output: instance.tokenUsage.output + usage.output,
          }
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, tokenUsage: newTokenUsage })

          return { instances: updatedInstances }
        }),

      updateContextWindowUsedForInstance: (instanceId, used) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(
              `[store] Cannot update context window for non-existent instance: ${instanceId}`,
            )
            return state
          }

          const newContextWindow = { ...instance.contextWindow, used }
          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, contextWindow: newContextWindow })

          return { instances: updatedInstances }
        }),

      setSessionForInstance: (instanceId, session) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(`[store] Cannot set session for non-existent instance: ${instanceId}`)
            return state
          }

          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, session })

          return { instances: updatedInstances }
        }),

      resetSessionStatsForInstance: instanceId =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(
              `[store] Cannot reset session stats for non-existent instance: ${instanceId}`,
            )
            return state
          }

          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, {
            ...instance,
            tokenUsage: { input: 0, output: 0 },
            contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
            session: { current: 0, total: 0 },
          })

          return { instances: updatedInstances }
        }),

      setMergeConflictForInstance: (instanceId, conflict) =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(
              `[store] Cannot set merge conflict for non-existent instance: ${instanceId}`,
            )
            return state
          }

          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, mergeConflict: conflict })

          return { instances: updatedInstances }
        }),

      clearMergeConflictForInstance: instanceId =>
        set(state => {
          const instance = state.instances.get(instanceId)
          if (!instance) {
            console.warn(
              `[store] Cannot clear merge conflict for non-existent instance: ${instanceId}`,
            )
            return state
          }

          const updatedInstances = new Map(state.instances)
          updatedInstances.set(instanceId, { ...instance, mergeConflict: null })

          return { instances: updatedInstances }
        }),

      // Reset
      reset: () => {
        // Clear any pending task chat events batch
        taskChatEventsBatch = []
        if (taskChatEventsBatchTimeout !== null) {
          clearTimeout(taskChatEventsBatchTimeout)
          taskChatEventsBatchTimeout = null
        }
        // Create fresh instances Map to avoid shared state between resets
        const freshInstances = new Map([
          [
            DEFAULT_INSTANCE_ID,
            createRalphInstance(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_NAME, DEFAULT_AGENT_NAME),
          ],
        ])
        set({ ...initialState, instances: freshInstances })
      },
    }),
    persistConfig,
  ),
)

/**
 * Flush any pending batched task chat events to the store immediately.
 * Useful for testing or when you need events to be applied synchronously.
 */
export { flushTaskChatEventsBatch }

// Export for testing
export { mergeEventsById }

export const selectInstances = (state: AppState) => state.instances
export const selectActiveInstanceId = (state: AppState) => state.activeInstanceId
export const selectActiveInstance = (state: AppState) =>
  state.instances.get(state.activeInstanceId) ?? null
export const selectInstance = (state: AppState, instanceId: string) =>
  state.instances.get(instanceId) ?? null
export const selectInstanceCount = (state: AppState) => state.instances.size
export const selectActiveInstanceName = (state: AppState) =>
  state.instances.get(state.activeInstanceId)?.name ?? DEFAULT_INSTANCE_NAME
export const selectActiveInstanceAgentName = (state: AppState) =>
  state.instances.get(state.activeInstanceId)?.agentName ?? DEFAULT_AGENT_NAME
/**
 * Get the Ralph status for the active instance.
 * Reads directly from the instances Map (single source of truth).
 */
export const selectRalphStatus = (state: AppState): RalphStatus => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.status ?? "stopped"
}

/**
 * Get the run started timestamp for the active instance.
 * Reads directly from the instances Map (single source of truth).
 */
export const selectRunStartedAt = (state: AppState): number | null => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.runStartedAt ?? null
}

export const selectInitialTaskCount = (state: AppState) => state.initialTaskCount

/**
 * Get the events for the active instance.
 * Reads directly from the instances Map (single source of truth).
 */
export const selectEvents = (state: AppState): ChatEvent[] => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.events ?? []
}

export const selectTasks = (state: AppState) => state.tasks
export const selectWorkspace = (state: AppState) => state.workspace
export const selectBranch = (state: AppState) => state.branch
export const selectIssuePrefix = (state: AppState) => state.issuePrefix

/**
 * Get the token usage for the active instance.
 * Reads directly from the instances Map (single source of truth).
 */
export const selectTokenUsage = (state: AppState): TokenUsage => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.tokenUsage ?? { input: 0, output: 0 }
}

/**
 * Get the context window for the active instance.
 * Reads directly from the instances Map (single source of truth).
 */
export const selectContextWindow = (state: AppState): ContextWindow => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.contextWindow ?? { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX }
}

/**
 * Get the session info for the active instance.
 * Reads directly from the instances Map (single source of truth).
 */
export const selectSession = (state: AppState): SessionInfo => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.session ?? { current: 0, total: 0 }
}
export const selectConnectionStatus = (state: AppState) => state.connectionStatus
export const selectIsConnected = (state: AppState) => state.connectionStatus === "connected"
export const selectHasInitialSync = (state: AppState) => state.hasInitialSync
export const selectPersistenceError = (state: AppState) => state.persistenceError
export const selectIsRalphRunning = (state: AppState) => selectRalphStatus(state) === "running"
/** Whether Ralph can accept user messages (running, paused, or stopping after current) */
export const selectCanAcceptMessages = (state: AppState) => {
  const status = selectRalphStatus(state)
  return status === "running" || status === "paused" || status === "stopping_after_current"
}
export const selectAccentColor = (state: AppState) => state.accentColor
export const selectSidebarWidth = (state: AppState) => state.sidebarWidth
export const selectTheme = (state: AppState) => state.theme
export const selectVSCodeThemeId = (state: AppState) => state.vscodeThemeId
export const selectLastDarkThemeId = (state: AppState) => state.lastDarkThemeId
export const selectLastLightThemeId = (state: AppState) => state.lastLightThemeId
export const selectCurrentTask = (state: AppState) =>
  state.tasks.find(t => t.status === "in_progress") ?? null
export const selectTaskChatOpen = (state: AppState) => state.taskChatOpen
export const selectTaskChatWidth = (state: AppState) => state.taskChatWidth
export const selectTaskChatMessages = (state: AppState) => state.taskChatMessages
export const selectTaskChatLoading = (state: AppState) => state.taskChatLoading
export const selectCurrentTaskChatSessionId = (state: AppState) => state.currentTaskChatSessionId
export const selectTaskChatEvents = (state: AppState) => state.taskChatEvents
export const selectViewingSessionIndex = (state: AppState) => state.viewingSessionIndex
export const selectSessionCount = (state: AppState) => countSessions(selectEvents(state))
export const selectCurrentSessionEvents = (state: AppState) =>
  getEventsForSession(selectEvents(state), state.viewingSessionIndex)
export const selectIsViewingLatestSession = (state: AppState) => state.viewingSessionIndex === null
export const selectTaskSearchQuery = (state: AppState) => state.taskSearchQuery
export const selectSelectedTaskId = (state: AppState) => state.selectedTaskId
export const selectVisibleTaskIds = (state: AppState) => state.visibleTaskIds
export const selectClosedTimeFilter = (state: AppState) => state.closedTimeFilter
/**
 * Get the task ID for the current session.
 * Returns the task ID if found from ralph_task_started events, or falls back to the instance's currentTaskId.
 * Task titles should be looked up from beads using the returned ID.
 */
export const selectSessionTask = (state: AppState): string | null => {
  const sessionEvents = getEventsForSession(selectEvents(state), state.viewingSessionIndex)
  const taskId = getTaskFromSessionEvents(sessionEvents)
  if (taskId) {
    return taskId
  }
  // Fallback: use the instance's currentTaskId if available
  // This handles page reload scenarios where the server restores the task info
  // but the ralph_task_started event may not be in the restored events
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.currentTaskId ?? null
}
export const selectIsSearchVisible = (state: AppState) => state.isSearchVisible
export const selectHotkeysDialogOpen = (state: AppState) => state.hotkeysDialogOpen
export const selectStatusCollapsedState = (state: AppState) => state.statusCollapsedState
export const selectParentCollapsedState = (state: AppState) => state.parentCollapsedState
export const selectTaskInputDraft = (state: AppState) => state.taskInputDraft
export const selectTaskChatInputDraft = (state: AppState) => state.taskChatInputDraft
export const selectCommentDraft = (state: AppState, taskId: string) =>
  state.commentDrafts[taskId] ?? ""
export const selectCommentDrafts = (state: AppState) => state.commentDrafts

export const selectInstanceStatus = (state: AppState, instanceId: string): RalphStatus => {
  const instance = state.instances.get(instanceId)
  return instance?.status ?? "stopped"
}

export const selectInstanceEvents = (state: AppState, instanceId: string): ChatEvent[] => {
  const instance = state.instances.get(instanceId)
  return instance?.events ?? []
}

export const selectInstanceTokenUsage = (state: AppState, instanceId: string): TokenUsage => {
  const instance = state.instances.get(instanceId)
  return instance?.tokenUsage ?? { input: 0, output: 0 }
}

export const selectInstanceContextWindow = (state: AppState, instanceId: string): ContextWindow => {
  const instance = state.instances.get(instanceId)
  return instance?.contextWindow ?? { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX }
}

export const selectInstanceSession = (state: AppState, instanceId: string): SessionInfo => {
  const instance = state.instances.get(instanceId)
  return instance?.session ?? { current: 0, total: 0 }
}

export const selectInstanceRunStartedAt = (state: AppState, instanceId: string): number | null => {
  const instance = state.instances.get(instanceId)
  return instance?.runStartedAt ?? null
}

export const selectInstanceWorktreePath = (state: AppState, instanceId: string): string | null => {
  const instance = state.instances.get(instanceId)
  return instance?.worktreePath ?? null
}

export const selectInstanceBranch = (state: AppState, instanceId: string): string | null => {
  const instance = state.instances.get(instanceId)
  return instance?.branch ?? null
}

export const selectInstanceCurrentTaskId = (state: AppState, instanceId: string): string | null => {
  const instance = state.instances.get(instanceId)
  return instance?.currentTaskId ?? null
}

export const selectInstanceName = (state: AppState, instanceId: string): string => {
  const instance = state.instances.get(instanceId)
  return instance?.name ?? ""
}

export const selectInstanceAgentName = (state: AppState, instanceId: string): string => {
  const instance = state.instances.get(instanceId)
  return instance?.agentName ?? DEFAULT_AGENT_NAME
}

export const selectInstanceCreatedAt = (state: AppState, instanceId: string): number | null => {
  const instance = state.instances.get(instanceId)
  return instance?.createdAt ?? null
}

export const selectIsInstanceRunning = (state: AppState, instanceId: string): boolean => {
  const instance = state.instances.get(instanceId)
  return instance?.status === "running"
}

export const selectInstanceSessionCount = (state: AppState, instanceId: string): number => {
  const instance = state.instances.get(instanceId)
  return instance ? countSessions(instance.events) : 0
}

export const selectInstanceMergeConflict = (
  state: AppState,
  instanceId: string,
): MergeConflict | null => {
  const instance = state.instances.get(instanceId)
  return instance?.mergeConflict ?? null
}

export const selectActiveInstanceMergeConflict = (state: AppState): MergeConflict | null => {
  const activeInstance = state.instances.get(state.activeInstanceId)
  return activeInstance?.mergeConflict ?? null
}

export const selectHasAnyMergeConflict = (state: AppState): boolean => {
  for (const instance of state.instances.values()) {
    if (instance.mergeConflict) {
      return true
    }
  }
  return false
}

export const selectInstancesWithMergeConflicts = (state: AppState): RalphInstance[] => {
  const result: RalphInstance[] = []
  for (const instance of state.instances.values()) {
    if (instance.mergeConflict) {
      result.push(instance)
    }
  }
  return result
}

/**
 * Returns a sorted array of task IDs that are currently being actively worked on by any running instance.
 * Returns an array (not a Set) to support shallow equality comparison with Zustand.
 * Use with `shallow` equality: `useAppStore(selectActivelyWorkingTaskIds, shallow)`
 */
export const selectActivelyWorkingTaskIds = (state: AppState): string[] => {
  const result: string[] = []
  for (const instance of state.instances.values()) {
    // Only include tasks from instances that are actually running
    if (instance.currentTaskId && instance.status === "running") {
      result.push(instance.currentTaskId)
    }
  }
  return result.sort()
}
