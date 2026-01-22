import { create } from "zustand"
import type { ConnectionStatus } from "../hooks/useWebSocket"
import type {
  ClosedTasksTimeFilter,
  MergeConflict,
  RalphEvent,
  RalphInstance,
  RalphStatus,
  SerializedInstance,
  Task,
  TaskChatMessage,
  TaskChatToolUse,
  Theme,
  TokenUsage,
  ContextWindow,
  IterationInfo,
  EventLog,
} from "@/types"
import { TASK_LIST_CLOSED_FILTER_STORAGE_KEY } from "@/constants"

export const SIDEBAR_WIDTH_STORAGE_KEY = "ralph-ui-sidebar-width"
export const TASK_CHAT_WIDTH_STORAGE_KEY = "ralph-ui-task-chat-width"
export const TASK_CHAT_OPEN_STORAGE_KEY = "ralph-ui-task-chat-open"
export const SHOW_TOOL_OUTPUT_STORAGE_KEY = "ralph-ui-show-tool-output"
export const ACTIVE_INSTANCE_ID_STORAGE_KEY = "ralph-ui-active-instance-id"

/**
 * Load sidebar width from localStorage with validation.
 */
function loadSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= 200 && parsed <= 600) {
        return parsed
      }
    }
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return 320 // default
}

/**
 * Save sidebar width to localStorage.
 */
function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // localStorage may not be available
  }
}

/**
 * Load task chat panel width from localStorage with validation.
 */
function loadTaskChatWidth(): number {
  try {
    const stored = localStorage.getItem(TASK_CHAT_WIDTH_STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= 280 && parsed <= 800) {
        return parsed
      }
    }
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return 400 // default
}

/**
 * Save task chat panel width to localStorage.
 */
function saveTaskChatWidth(width: number): void {
  try {
    localStorage.setItem(TASK_CHAT_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // localStorage may not be available
  }
}

/**
 * Load task chat open/closed state from localStorage.
 */
function loadTaskChatOpen(): boolean {
  try {
    const stored = localStorage.getItem(TASK_CHAT_OPEN_STORAGE_KEY)
    if (stored === "true") return true
    if (stored === "false") return false
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return true // default - open
}

/**
 * Save task chat open/closed state to localStorage.
 */
function saveTaskChatOpen(open: boolean): void {
  try {
    localStorage.setItem(TASK_CHAT_OPEN_STORAGE_KEY, String(open))
  } catch {
    // localStorage may not be available
  }
}

/**
 * List of valid closed time filter options.
 */
const CLOSED_TIME_FILTERS: ClosedTasksTimeFilter[] = [
  "past_hour",
  "past_day",
  "past_week",
  "all_time",
]

/**
 * Load closed time filter from localStorage with validation.
 */
function loadClosedTimeFilter(): ClosedTasksTimeFilter {
  try {
    const stored = localStorage.getItem(TASK_LIST_CLOSED_FILTER_STORAGE_KEY)
    if (stored && CLOSED_TIME_FILTERS.includes(stored as ClosedTasksTimeFilter)) {
      return stored as ClosedTasksTimeFilter
    }
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return "past_day" // default
}

/**
 * Save closed time filter to localStorage.
 */
function saveClosedTimeFilter(filter: ClosedTasksTimeFilter): void {
  try {
    localStorage.setItem(TASK_LIST_CLOSED_FILTER_STORAGE_KEY, filter)
  } catch {
    // localStorage may not be available
  }
}

/**
 * Load tool output visibility setting from localStorage.
 */
function loadShowToolOutput(): boolean {
  try {
    const stored = localStorage.getItem(SHOW_TOOL_OUTPUT_STORAGE_KEY)
    if (stored !== null) {
      return stored === "true"
    }
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return false // default - collapsed
}

/**
 * Save tool output visibility setting to localStorage.
 */
function saveShowToolOutput(show: boolean): void {
  try {
    localStorage.setItem(SHOW_TOOL_OUTPUT_STORAGE_KEY, String(show))
  } catch {
    // localStorage may not be available
  }
}

/**
 * Load active instance ID from localStorage.
 */
function loadActiveInstanceId(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_INSTANCE_ID_STORAGE_KEY)
    if (stored && stored.trim().length > 0) {
      return stored
    }
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return DEFAULT_INSTANCE_ID // default
}

/**
 * Save active instance ID to localStorage.
 */
function saveActiveInstanceId(instanceId: string): void {
  try {
    localStorage.setItem(ACTIVE_INSTANCE_ID_STORAGE_KEY, instanceId)
  } catch {
    // localStorage may not be available
  }
}

/** Get the cutoff timestamp for a time filter */
export function getTimeFilterCutoff(filter: ClosedTasksTimeFilter): Date | null {
  if (filter === "all_time") return null
  const now = new Date()
  switch (filter) {
    case "past_hour":
      return new Date(now.getTime() - 60 * 60 * 1000)
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
    iteration: { current: 0, total: 0 },
    worktreePath: null,
    branch: null,
    currentTaskId: null,
    currentTaskTitle: null,
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

  // === Legacy flat fields (for backward compatibility) ===
  // These fields delegate to the active instance. They will be deprecated
  // once all consumers are updated to use the instances Map directly.

  // Ralph process status
  ralphStatus: RalphStatus

  // Timestamp when Ralph started running (null if not running)
  runStartedAt: number | null

  // Initial task count when Ralph started (for progress tracking)
  initialTaskCount: number | null

  // Event stream from ralph
  events: RalphEvent[]

  // === Workspace state (shared across all instances) ===

  // Tasks from ralph
  tasks: Task[]

  // Current workspace path
  workspace: string | null

  // Git branch name
  branch: string | null

  // Issue prefix for this workspace (e.g., "rui")
  issuePrefix: string | null

  // Token usage
  tokenUsage: TokenUsage

  // Context window usage
  contextWindow: ContextWindow

  // Iteration progress
  iteration: IterationInfo

  // WebSocket connection status
  connectionStatus: ConnectionStatus

  // Accent color from peacock settings (null means use default/black)
  accentColor: string | null

  // UI State
  sidebarOpen: boolean
  sidebarWidth: number

  // Theme
  theme: Theme

  // Event log viewer state
  viewingEventLogId: string | null
  viewingEventLog: EventLog | null
  eventLogLoading: boolean
  eventLogError: string | null

  // Task chat panel state
  taskChatOpen: boolean
  taskChatWidth: number
  taskChatMessages: TaskChatMessage[]
  taskChatToolUses: TaskChatToolUse[]
  taskChatLoading: boolean
  taskChatStreamingText: string

  // Iteration view state (null = show current/latest iteration)
  viewingIterationIndex: number | null

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

  // Task chat events (unified array like EventStream's events[])
  taskChatEvents: RalphEvent[]

  // Reconnection state (for auto-resuming when reconnecting mid-iteration)
  /** Whether Ralph was running when the connection was lost */
  wasRunningBeforeDisconnect: boolean
}

// Store Actions

export interface AppActions {
  // Ralph status
  setRalphStatus: (status: RalphStatus) => void

  // Events
  addEvent: (event: RalphEvent) => void
  setEvents: (events: RalphEvent[]) => void
  clearEvents: () => void

  // Tasks
  setTasks: (tasks: Task[]) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  clearTasks: () => void
  refreshTasks: () => Promise<void>

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

  // Iteration
  setIteration: (iteration: IterationInfo) => void

  // Connection
  setConnectionStatus: (status: ConnectionStatus) => void

  // UI State
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void

  // Theme
  setTheme: (theme: Theme) => void

  // Event log viewer
  setViewingEventLogId: (id: string | null) => void
  setViewingEventLog: (eventLog: EventLog | null) => void
  setEventLogLoading: (loading: boolean) => void
  setEventLogError: (error: string | null) => void
  clearEventLogViewer: () => void

  // Task chat panel
  setTaskChatOpen: (open: boolean) => void
  toggleTaskChat: () => void
  setTaskChatWidth: (width: number) => void
  addTaskChatMessage: (message: TaskChatMessage) => void
  /** Atomically adds a completed assistant message while clearing streaming state - prevents brief duplicates */
  completeTaskChatMessage: (message: TaskChatMessage) => void
  removeTaskChatMessage: (id: string) => void
  clearTaskChatMessages: () => void
  setTaskChatLoading: (loading: boolean) => void
  setTaskChatStreamingText: (text: string) => void
  appendTaskChatStreamingText: (text: string) => void
  addTaskChatToolUse: (toolUse: TaskChatToolUse) => void
  updateTaskChatToolUse: (toolUseId: string, updates: Partial<TaskChatToolUse>) => void
  clearTaskChatToolUses: () => void

  // Task chat events (unified array)
  addTaskChatEvent: (event: RalphEvent) => void
  clearTaskChatEvents: () => void

  // Iteration view
  setViewingIterationIndex: (index: number | null) => void
  goToPreviousIteration: () => void
  goToNextIteration: () => void
  goToLatestIteration: () => void

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

  // Reconnection state (for auto-resuming when reconnecting mid-iteration)
  /** Mark that Ralph was running before disconnect (called when connection is lost) */
  markRunningBeforeDisconnect: () => void
  /** Clear the running-before-disconnect flag */
  clearRunningBeforeDisconnect: () => void

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
  addEventForInstance: (instanceId: string, event: RalphEvent) => void
  /** Set events for a specific instance by ID */
  setEventsForInstance: (instanceId: string, events: RalphEvent[]) => void
  /** Set status for a specific instance by ID */
  setStatusForInstance: (instanceId: string, status: RalphStatus) => void
  /** Add token usage for a specific instance by ID */
  addTokenUsageForInstance: (instanceId: string, usage: TokenUsage) => void
  /** Update context window usage for a specific instance by ID */
  updateContextWindowUsedForInstance: (instanceId: string, used: number) => void
  /** Set iteration for a specific instance by ID */
  setIterationForInstance: (instanceId: string, iteration: IterationInfo) => void
  /** Set merge conflict for a specific instance by ID */
  setMergeConflictForInstance: (instanceId: string, conflict: MergeConflict | null) => void
  /** Clear merge conflict for a specific instance by ID */
  clearMergeConflictForInstance: (instanceId: string) => void

  // Reset
  reset: () => void
}

/**
 * Checks if an event is an iteration boundary (system init event).
 */
export function isIterationBoundary(event: RalphEvent): boolean {
  return event.type === "system" && (event as any).subtype === "init"
}

/**
 * Gets the indices of iteration boundaries in the events array.
 * Returns an array of indices where each iteration starts.
 */
export function getIterationBoundaries(events: RalphEvent[]): number[] {
  const boundaries: number[] = []
  events.forEach((event, index) => {
    if (isIterationBoundary(event)) {
      boundaries.push(index)
    }
  })
  return boundaries
}

/**
 * Counts the total number of iterations in the events array.
 */
export function countIterations(events: RalphEvent[]): number {
  return getIterationBoundaries(events).length
}

/**
 * Gets events for a specific iteration.
 * Returns events from the iteration boundary up to (but not including) the next boundary.
 * If iterationIndex is null or out of bounds, returns all events.
 */
export function getEventsForIteration(
  events: RalphEvent[],
  iterationIndex: number | null,
): RalphEvent[] {
  if (iterationIndex === null) {
    // Return all events from the latest iteration
    const boundaries = getIterationBoundaries(events)
    if (boundaries.length === 0) return events
    const lastBoundary = boundaries[boundaries.length - 1]
    return events.slice(lastBoundary)
  }

  const boundaries = getIterationBoundaries(events)
  if (boundaries.length === 0 || iterationIndex < 0 || iterationIndex >= boundaries.length) {
    return events
  }

  const startIndex = boundaries[iterationIndex]
  const endIndex = boundaries[iterationIndex + 1] ?? events.length
  return events.slice(startIndex, endIndex)
}

/**
 * Extracts task information from iteration events.
 * Looks for ralph_task_started events to get the task being worked on.
 * Returns task info if found, with title falling back to taskId if not provided.
 */
export function getTaskFromIterationEvents(
  events: RalphEvent[],
): { id: string | null; title: string } | null {
  for (const event of events) {
    if (event.type === "ralph_task_started") {
      const taskId = (event as any).taskId as string | undefined
      const taskTitle = (event as any).taskTitle as string | undefined
      // Accept tasks with taskTitle or taskId (title can fall back to ID)
      if (taskTitle) {
        return { id: taskId ?? null, title: taskTitle }
      }
      if (taskId) {
        return { id: taskId, title: taskId } // Use ID as fallback title
      }
    }
  }
  return null
}

const defaultSidebarWidth = 320
const defaultTaskChatWidth = 400

/**
 * Creates the initial instances Map with a default instance.
 * This is called fresh each time to avoid shared state between tests.
 */
function createInitialInstances(): Map<string, RalphInstance> {
  const defaultInstance = createRalphInstance(
    DEFAULT_INSTANCE_ID,
    DEFAULT_INSTANCE_NAME,
    DEFAULT_AGENT_NAME,
  )
  return new Map([[DEFAULT_INSTANCE_ID, defaultInstance]])
}

const initialState: AppState = {
  // Multi-instance state
  instances: createInitialInstances(),
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
  iteration: { current: 0, total: 0 },
  connectionStatus: "disconnected",
  accentColor: null,
  sidebarOpen: true,
  sidebarWidth: defaultSidebarWidth,
  theme: "system",
  viewingEventLogId: null,
  viewingEventLog: null,
  eventLogLoading: false,
  eventLogError: null,
  taskChatOpen: true,
  taskChatWidth: defaultTaskChatWidth,
  taskChatMessages: [],
  taskChatToolUses: [],
  taskChatLoading: false,
  taskChatStreamingText: "",
  viewingIterationIndex: null,
  taskSearchQuery: "",
  selectedTaskId: null,
  visibleTaskIds: [],
  closedTimeFilter: "past_day",
  showToolOutput: false,
  isSearchVisible: false,
  wasRunningBeforeDisconnect: false,
  taskChatEvents: [],
}

// Create the store with localStorage initialization
const getInitialStateWithPersistence = (): AppState => {
  // Create fresh instances Map to avoid shared state
  const instances = createInitialInstances()

  // Load activeInstanceId from localStorage, but validate it exists
  // If the stored ID doesn't exist in instances, fall back to DEFAULT_INSTANCE_ID
  const storedActiveId = loadActiveInstanceId()
  const activeInstanceId = instances.has(storedActiveId) ? storedActiveId : DEFAULT_INSTANCE_ID

  return {
    ...initialState,
    instances,
    activeInstanceId,
    sidebarWidth: loadSidebarWidth(),
    taskChatWidth: loadTaskChatWidth(),
    taskChatOpen: loadTaskChatOpen(),
    closedTimeFilter: loadClosedTimeFilter(),
    showToolOutput: loadShowToolOutput(),
  }
}

export const useAppStore = create<AppState & AppActions>(set => ({
  ...getInitialStateWithPersistence(),

  // Ralph status
  setRalphStatus: status =>
    set(state => {
      const now = Date.now()
      const isTransitioningToRunning = status === "running" && state.ralphStatus !== "running"
      const isStopping = status === "stopped"

      // Calculate new runStartedAt
      const newRunStartedAt =
        isTransitioningToRunning ? now
        : isStopping ? null
        : state.runStartedAt

      // Calculate new initialTaskCount
      const newInitialTaskCount =
        isTransitioningToRunning ? state.tasks.length
        : isStopping ? null
        : state.initialTaskCount

      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          status,
          runStartedAt: newRunStartedAt,
        })
      }

      return {
        ralphStatus: status,
        runStartedAt: newRunStartedAt,
        initialTaskCount: newInitialTaskCount,
        instances: updatedInstances,
      }
    }),

  // Events
  addEvent: event =>
    set(state => {
      const newEvents = [...state.events, event]
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          events: newEvents,
        })
      }
      return {
        events: newEvents,
        instances: updatedInstances,
      }
    }),

  setEvents: events =>
    set(state => {
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          events,
        })
      }
      return {
        events,
        instances: updatedInstances,
      }
    }),

  clearEvents: () =>
    set(state => {
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          events: [],
        })
      }
      return {
        events: [],
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

  refreshTasks: async () => {
    try {
      const response = await fetch("/api/tasks?all=true")
      const data = (await response.json()) as { ok: boolean; issues?: Task[] }
      if (data.ok && data.issues) {
        set({ tasks: data.issues })
      }
    } catch (err) {
      console.error("Failed to refresh tasks:", err)
    }
  },

  // Workspace
  setWorkspace: workspace => set({ workspace }),
  clearWorkspaceData: () =>
    set(state => {
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          events: [],
          tokenUsage: { input: 0, output: 0 },
          contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
          iteration: { current: 0, total: 0 },
          runStartedAt: null,
          status: "stopped",
        })
      }
      return {
        // Clear tasks immediately to avoid showing stale data
        tasks: [],
        // Clear events and iteration state
        events: [],
        viewingIterationIndex: null,
        // Reset token and context window usage
        tokenUsage: { input: 0, output: 0 },
        contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
        iteration: { current: 0, total: 0 },
        // Reset run state
        runStartedAt: null,
        initialTaskCount: null,
        ralphStatus: "stopped" as const,
        // Clear task chat messages, tool uses, and events
        taskChatMessages: [],
        taskChatToolUses: [],
        taskChatLoading: false,
        taskChatStreamingText: "",
        taskChatEvents: [],
        // Clear event log viewer state
        viewingEventLogId: null,
        viewingEventLog: null,
        eventLogLoading: false,
        eventLogError: null,
        // Updated instances Map
        instances: updatedInstances,
      }
    }),

  // Accent color
  setAccentColor: color => set({ accentColor: color }),

  // Branch
  setBranch: branch => set({ branch }),

  // Issue prefix
  setIssuePrefix: prefix => set({ issuePrefix: prefix }),

  // Token usage
  setTokenUsage: usage =>
    set(state => {
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          tokenUsage: usage,
        })
      }
      return {
        tokenUsage: usage,
        instances: updatedInstances,
      }
    }),
  addTokenUsage: usage =>
    set(state => {
      const newTokenUsage = {
        input: state.tokenUsage.input + usage.input,
        output: state.tokenUsage.output + usage.output,
      }
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          tokenUsage: newTokenUsage,
        })
      }
      return {
        tokenUsage: newTokenUsage,
        instances: updatedInstances,
      }
    }),

  // Context window
  setContextWindow: contextWindow =>
    set(state => {
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          contextWindow,
        })
      }
      return {
        contextWindow,
        instances: updatedInstances,
      }
    }),
  updateContextWindowUsed: used =>
    set(state => {
      const newContextWindow = { ...state.contextWindow, used }
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          contextWindow: newContextWindow,
        })
      }
      return {
        contextWindow: newContextWindow,
        instances: updatedInstances,
      }
    }),

  // Iteration
  setIteration: iteration =>
    set(state => {
      // Update active instance in the instances Map
      const activeInstance = state.instances.get(state.activeInstanceId)
      const updatedInstances = new Map(state.instances)
      if (activeInstance) {
        updatedInstances.set(state.activeInstanceId, {
          ...activeInstance,
          iteration,
        })
      }
      return {
        iteration,
        instances: updatedInstances,
      }
    }),

  // Connection
  setConnectionStatus: status => set({ connectionStatus: status }),

  // UI State
  setSidebarOpen: open => set({ sidebarOpen: open }),
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarWidth: width => {
    saveSidebarWidth(width)
    set({ sidebarWidth: width })
  },

  // Theme
  setTheme: theme => set({ theme }),

  // Event log viewer
  setViewingEventLogId: id => set({ viewingEventLogId: id }),
  setViewingEventLog: eventLog => set({ viewingEventLog: eventLog }),
  setEventLogLoading: loading => set({ eventLogLoading: loading }),
  setEventLogError: error => set({ eventLogError: error }),
  clearEventLogViewer: () =>
    set({
      viewingEventLogId: null,
      viewingEventLog: null,
      eventLogLoading: false,
      eventLogError: null,
    }),

  // Task chat panel
  setTaskChatOpen: open => {
    saveTaskChatOpen(open)
    set({ taskChatOpen: open })
  },
  toggleTaskChat: () =>
    set(state => {
      const newValue = !state.taskChatOpen
      saveTaskChatOpen(newValue)
      return { taskChatOpen: newValue }
    }),
  setTaskChatWidth: width => {
    saveTaskChatWidth(width)
    set({ taskChatWidth: width })
  },
  addTaskChatMessage: message =>
    set(state => ({
      taskChatMessages: [...state.taskChatMessages, message],
    })),
  completeTaskChatMessage: message =>
    set(state => ({
      taskChatMessages: [...state.taskChatMessages, message],
      taskChatStreamingText: "",
      taskChatLoading: false,
    })),
  removeTaskChatMessage: id =>
    set(state => ({
      taskChatMessages: state.taskChatMessages.filter(m => m.id !== id),
    })),
  clearTaskChatMessages: () =>
    set({ taskChatMessages: [], taskChatToolUses: [], taskChatEvents: [] }),
  setTaskChatLoading: loading => set({ taskChatLoading: loading }),
  setTaskChatStreamingText: text => set({ taskChatStreamingText: text }),
  appendTaskChatStreamingText: text =>
    set(state => ({ taskChatStreamingText: state.taskChatStreamingText + text })),
  addTaskChatToolUse: toolUse =>
    set(state => {
      // Check if this tool use already exists (by toolUseId)
      const existingIndex = state.taskChatToolUses.findIndex(t => t.toolUseId === toolUse.toolUseId)
      if (existingIndex !== -1) {
        // Update existing tool use instead of adding duplicate
        // Preserve original timestamp and sequence for ordering stability
        return {
          taskChatToolUses: state.taskChatToolUses.map((t, i) =>
            i === existingIndex ?
              { ...t, ...toolUse, timestamp: t.timestamp, sequence: t.sequence ?? toolUse.sequence }
            : t,
          ),
        }
      }
      // Add new tool use
      return {
        taskChatToolUses: [
          ...state.taskChatToolUses,
          { ...toolUse, timestamp: toolUse.timestamp ?? Date.now() },
        ],
      }
    }),
  updateTaskChatToolUse: (toolUseId, updates) =>
    set(state => ({
      taskChatToolUses: state.taskChatToolUses.map(t =>
        t.toolUseId === toolUseId ? { ...t, ...updates } : t,
      ),
    })),
  clearTaskChatToolUses: () => set({ taskChatToolUses: [] }),

  // Task chat events (unified array like EventStream)
  addTaskChatEvent: event =>
    set(state => ({
      taskChatEvents: [...state.taskChatEvents, event],
    })),
  clearTaskChatEvents: () => set({ taskChatEvents: [] }),

  // Iteration view
  setViewingIterationIndex: index => set({ viewingIterationIndex: index }),
  goToPreviousIteration: () =>
    set(state => {
      const totalIterations = countIterations(state.events)
      if (totalIterations === 0) return state

      // If viewing latest (null), go to second-to-last iteration
      if (state.viewingIterationIndex === null) {
        const newIndex = totalIterations > 1 ? totalIterations - 2 : 0
        return { viewingIterationIndex: newIndex }
      }

      // If already at first iteration, stay there
      if (state.viewingIterationIndex <= 0) return state

      return { viewingIterationIndex: state.viewingIterationIndex - 1 }
    }),
  goToNextIteration: () =>
    set(state => {
      const totalIterations = countIterations(state.events)
      if (totalIterations === 0) return state

      // If already viewing latest, stay there
      if (state.viewingIterationIndex === null) return state

      // If at last iteration, switch to latest (null)
      if (state.viewingIterationIndex >= totalIterations - 1) {
        return { viewingIterationIndex: null }
      }

      return { viewingIterationIndex: state.viewingIterationIndex + 1 }
    }),
  goToLatestIteration: () => set({ viewingIterationIndex: null }),

  // Task search
  setTaskSearchQuery: query => set({ taskSearchQuery: query }),
  clearTaskSearchQuery: () => set({ taskSearchQuery: "" }),

  // Task selection (for keyboard navigation)
  setSelectedTaskId: id => set({ selectedTaskId: id }),
  clearSelectedTaskId: () => set({ selectedTaskId: null }),
  setVisibleTaskIds: ids => set({ visibleTaskIds: ids }),

  // Closed time filter
  setClosedTimeFilter: filter => {
    saveClosedTimeFilter(filter)
    set({ closedTimeFilter: filter })
  },

  // Tool output visibility
  setShowToolOutput: show => {
    saveShowToolOutput(show)
    set({ showToolOutput: show })
  },
  toggleToolOutput: () =>
    set(state => {
      const newValue = !state.showToolOutput
      saveShowToolOutput(newValue)
      return { showToolOutput: newValue }
    }),

  // Search visibility
  setSearchVisible: visible => set({ isSearchVisible: visible }),
  showSearch: () => set({ isSearchVisible: true }),
  hideSearch: () => set({ isSearchVisible: false, taskSearchQuery: "" }),

  // Reconnection state (for auto-resuming when reconnecting mid-iteration)
  markRunningBeforeDisconnect: () =>
    set(state => ({
      wasRunningBeforeDisconnect: state.ralphStatus === "running" || state.ralphStatus === "paused",
    })),
  clearRunningBeforeDisconnect: () => set({ wasRunningBeforeDisconnect: false }),

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

      // Persist to localStorage
      saveActiveInstanceId(instanceId)

      // Get the new active instance to sync flat fields
      const instance = state.instances.get(instanceId)!

      return {
        activeInstanceId: instanceId,
        // Sync flat fields from the new active instance for backward compatibility
        ralphStatus: instance.status,
        runStartedAt: instance.runStartedAt,
        events: instance.events,
        tokenUsage: instance.tokenUsage,
        contextWindow: instance.contextWindow,
        iteration: instance.iteration,
        // Reset iteration view when switching instances
        viewingIterationIndex: null,
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

      // Persist to localStorage (auto-select the newly created instance)
      saveActiveInstanceId(id)

      // Auto-select the newly created instance
      return {
        instances: updatedInstances,
        activeInstanceId: id,
        // Sync flat fields from the new instance for backward compatibility
        ralphStatus: newInstance.status,
        runStartedAt: newInstance.runStartedAt,
        events: newInstance.events,
        tokenUsage: newInstance.tokenUsage,
        contextWindow: newInstance.contextWindow,
        iteration: newInstance.iteration,
        // Reset iteration view when switching instances
        viewingIterationIndex: null,
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
        iteration: { current: 0, total: 0 },
        runStartedAt: null,
        currentTaskId: null,
        currentTaskTitle: null,
        mergeConflict: null,
      }

      const updatedInstances = new Map(state.instances)
      updatedInstances.set(instanceId, cleanedInstance)

      // If cleaning up the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        return {
          instances: updatedInstances,
          ralphStatus: "stopped" as const,
          events: [],
          tokenUsage: { input: 0, output: 0 },
          contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
          iteration: { current: 0, total: 0 },
          runStartedAt: null,
          initialTaskCount: null,
          viewingIterationIndex: null,
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
            currentTaskTitle: serverInstance.currentTaskTitle,
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
            iteration: { current: 0, total: 0 },
            worktreePath: serverInstance.worktreePath,
            branch: serverInstance.branch,
            currentTaskId: serverInstance.currentTaskId,
            currentTaskTitle: serverInstance.currentTaskTitle,
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

      // Get the (possibly updated) active instance for syncing flat fields
      const activeInstance = updatedInstances.get(activeInstanceId)

      return {
        instances: updatedInstances,
        activeInstanceId,
        // Sync flat fields for backward compatibility if active instance changed
        ...(activeInstance ?
          {
            ralphStatus: activeInstance.status,
            events: activeInstance.events,
            tokenUsage: activeInstance.tokenUsage,
            contextWindow: activeInstance.contextWindow,
            iteration: activeInstance.iteration,
            runStartedAt: activeInstance.runStartedAt,
          }
        : {}),
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

      const newEvents = [...instance.events, event]
      const updatedInstances = new Map(state.instances)
      updatedInstances.set(instanceId, { ...instance, events: newEvents })

      // If this is the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        return {
          instances: updatedInstances,
          events: newEvents,
        }
      }

      return { instances: updatedInstances }
    }),

  setEventsForInstance: (instanceId, events) =>
    set(state => {
      const instance = state.instances.get(instanceId)
      if (!instance) {
        console.warn(`[store] Cannot set events for non-existent instance: ${instanceId}`)
        return state
      }

      const updatedInstances = new Map(state.instances)
      updatedInstances.set(instanceId, { ...instance, events })

      // If this is the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        return {
          instances: updatedInstances,
          events,
        }
      }

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

      // If this is the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        const newInitialTaskCount =
          isTransitioningToRunning ? state.tasks.length
          : isStopping ? null
          : state.initialTaskCount

        return {
          instances: updatedInstances,
          ralphStatus: status,
          runStartedAt: newRunStartedAt,
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

      // If this is the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        return {
          instances: updatedInstances,
          tokenUsage: newTokenUsage,
        }
      }

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

      // If this is the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        return {
          instances: updatedInstances,
          contextWindow: newContextWindow,
        }
      }

      return { instances: updatedInstances }
    }),

  setIterationForInstance: (instanceId, iteration) =>
    set(state => {
      const instance = state.instances.get(instanceId)
      if (!instance) {
        console.warn(`[store] Cannot set iteration for non-existent instance: ${instanceId}`)
        return state
      }

      const updatedInstances = new Map(state.instances)
      updatedInstances.set(instanceId, { ...instance, iteration })

      // If this is the active instance, also update flat fields for backward compatibility
      if (state.activeInstanceId === instanceId) {
        return {
          instances: updatedInstances,
          iteration,
        }
      }

      return { instances: updatedInstances }
    }),

  setMergeConflictForInstance: (instanceId, conflict) =>
    set(state => {
      const instance = state.instances.get(instanceId)
      if (!instance) {
        console.warn(`[store] Cannot set merge conflict for non-existent instance: ${instanceId}`)
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
        console.warn(`[store] Cannot clear merge conflict for non-existent instance: ${instanceId}`)
        return state
      }

      const updatedInstances = new Map(state.instances)
      updatedInstances.set(instanceId, { ...instance, mergeConflict: null })

      return { instances: updatedInstances }
    }),

  // Reset
  reset: () => set({ ...initialState, instances: createInitialInstances() }),
}))

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
export const selectActiveInstanceCurrentTaskTitle = (state: AppState) =>
  state.instances.get(state.activeInstanceId)?.currentTaskTitle ?? null

export const selectRalphStatus = (state: AppState) => {
  const activeInstance = state.instances?.get(state.activeInstanceId)
  return activeInstance?.status ?? state.ralphStatus
}
export const selectRunStartedAt = (state: AppState) => {
  const activeInstance = state.instances?.get(state.activeInstanceId)
  return activeInstance?.runStartedAt ?? state.runStartedAt
}
export const selectInitialTaskCount = (state: AppState) => state.initialTaskCount
export const selectEvents = (state: AppState) => {
  const activeInstance = state.instances?.get(state.activeInstanceId)
  return activeInstance?.events ?? state.events
}
export const selectTasks = (state: AppState) => state.tasks
export const selectWorkspace = (state: AppState) => state.workspace
export const selectBranch = (state: AppState) => state.branch
export const selectIssuePrefix = (state: AppState) => state.issuePrefix
export const selectTokenUsage = (state: AppState) => {
  const activeInstance = state.instances?.get(state.activeInstanceId)
  return activeInstance?.tokenUsage ?? state.tokenUsage
}
export const selectContextWindow = (state: AppState) => {
  const activeInstance = state.instances?.get(state.activeInstanceId)
  return activeInstance?.contextWindow ?? state.contextWindow
}
export const selectIteration = (state: AppState) => {
  const activeInstance = state.instances?.get(state.activeInstanceId)
  return activeInstance?.iteration ?? state.iteration
}
export const selectConnectionStatus = (state: AppState) => state.connectionStatus
export const selectIsConnected = (state: AppState) => state.connectionStatus === "connected"
export const selectIsRalphRunning = (state: AppState) => state.ralphStatus === "running"
export const selectAccentColor = (state: AppState) => state.accentColor
export const selectSidebarOpen = (state: AppState) => state.sidebarOpen
export const selectSidebarWidth = (state: AppState) => state.sidebarWidth
export const selectTheme = (state: AppState) => state.theme
export const selectCurrentTask = (state: AppState) =>
  state.tasks.find(t => t.status === "in_progress") ?? null
export const selectViewingEventLogId = (state: AppState) => state.viewingEventLogId
export const selectViewingEventLog = (state: AppState) => state.viewingEventLog
export const selectEventLogLoading = (state: AppState) => state.eventLogLoading
export const selectEventLogError = (state: AppState) => state.eventLogError
export const selectTaskChatOpen = (state: AppState) => state.taskChatOpen
export const selectTaskChatWidth = (state: AppState) => state.taskChatWidth
export const selectTaskChatMessages = (state: AppState) => state.taskChatMessages
export const selectTaskChatToolUses = (state: AppState) => state.taskChatToolUses
export const selectTaskChatLoading = (state: AppState) => state.taskChatLoading
export const selectTaskChatStreamingText = (state: AppState) => state.taskChatStreamingText
export const selectTaskChatEvents = (state: AppState) => state.taskChatEvents
export const selectViewingIterationIndex = (state: AppState) => state.viewingIterationIndex
export const selectIterationCount = (state: AppState) => countIterations(state.events)
export const selectCurrentIterationEvents = (state: AppState) =>
  getEventsForIteration(state.events, state.viewingIterationIndex)
export const selectIsViewingLatestIteration = (state: AppState) =>
  state.viewingIterationIndex === null
export const selectTaskSearchQuery = (state: AppState) => state.taskSearchQuery
export const selectSelectedTaskId = (state: AppState) => state.selectedTaskId
export const selectVisibleTaskIds = (state: AppState) => state.visibleTaskIds
export const selectClosedTimeFilter = (state: AppState) => state.closedTimeFilter
export const selectIterationTask = (state: AppState) => {
  const iterationEvents = getEventsForIteration(state.events, state.viewingIterationIndex)
  return getTaskFromIterationEvents(iterationEvents)
}
export const selectIsSearchVisible = (state: AppState) => state.isSearchVisible

export const selectInstanceStatus = (state: AppState, instanceId: string): RalphStatus => {
  const instance = state.instances.get(instanceId)
  return instance?.status ?? "stopped"
}

export const selectInstanceEvents = (state: AppState, instanceId: string): RalphEvent[] => {
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

export const selectInstanceIteration = (state: AppState, instanceId: string): IterationInfo => {
  const instance = state.instances.get(instanceId)
  return instance?.iteration ?? { current: 0, total: 0 }
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

export const selectInstanceCurrentTaskTitle = (
  state: AppState,
  instanceId: string,
): string | null => {
  const instance = state.instances.get(instanceId)
  return instance?.currentTaskTitle ?? null
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

export const selectInstanceIterationCount = (state: AppState, instanceId: string): number => {
  const instance = state.instances.get(instanceId)
  return instance ? countIterations(instance.events) : 0
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
