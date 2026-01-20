import { create } from "zustand"
import type { ConnectionStatus } from "../hooks/useWebSocket"

// localStorage keys
export const SIDEBAR_WIDTH_STORAGE_KEY = "ralph-ui-sidebar-width"
export const TASK_CHAT_WIDTH_STORAGE_KEY = "ralph-ui-task-chat-width"
export const CLOSED_FILTER_STORAGE_KEY = "ralph-ui-task-list-closed-filter"

// Helper functions for localStorage
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

function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // localStorage may not be available
  }
}

// Task chat panel localStorage persistence
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

function saveTaskChatWidth(width: number): void {
  try {
    localStorage.setItem(TASK_CHAT_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // localStorage may not be available
  }
}

// Closed time filter types and localStorage persistence
export type ClosedTasksTimeFilter = "past_hour" | "past_day" | "past_week" | "all_time"

const CLOSED_TIME_FILTERS: ClosedTasksTimeFilter[] = [
  "past_hour",
  "past_day",
  "past_week",
  "all_time",
]

function loadClosedTimeFilter(): ClosedTasksTimeFilter {
  try {
    const stored = localStorage.getItem(CLOSED_FILTER_STORAGE_KEY)
    if (stored && CLOSED_TIME_FILTERS.includes(stored as ClosedTasksTimeFilter)) {
      return stored as ClosedTasksTimeFilter
    }
  } catch {
    // localStorage may not be available (SSR, private mode, etc.)
  }
  return "past_day" // default
}

function saveClosedTimeFilter(filter: ClosedTasksTimeFilter): void {
  try {
    localStorage.setItem(CLOSED_FILTER_STORAGE_KEY, filter)
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

// Types

export const RALPH_STATUSES = [
  "stopped",
  "starting",
  "running",
  "paused",
  "stopping",
  "stopping_after_current",
] as const

export type RalphStatus = (typeof RALPH_STATUSES)[number]

export function isRalphStatus(value: unknown): value is RalphStatus {
  return typeof value === "string" && RALPH_STATUSES.includes(value as RalphStatus)
}
export type Theme = "system" | "light" | "dark"

export interface RalphEvent {
  type: string
  timestamp: number
  [key: string]: unknown
}

export type TaskStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed"

export interface Task {
  /** Unique task ID (e.g., "rui-4rt.5") */
  id: string
  /** Task title */
  title: string
  /** Optional description */
  description?: string
  /** Task status */
  status: TaskStatus
  /** Priority (0 = highest, 4 = lowest) */
  priority?: number
  /** Issue type (e.g., "task", "bug", "epic") */
  issue_type?: string
  /** Parent issue ID */
  parent?: string
  /** Timestamp when task was created */
  created_at?: string
  /** Timestamp when task was closed */
  closed_at?: string
}

export interface TokenUsage {
  input: number
  output: number
}

export interface ContextWindow {
  used: number
  max: number
}

// Default context window size for Claude Sonnet (200k tokens)
export const DEFAULT_CONTEXT_WINDOW_MAX = 200_000

export interface IterationInfo {
  current: number
  total: number
}

// Event log metadata type (matches server EventLogMetadata)
export interface EventLogMetadata {
  taskId?: string
  title?: string
  source?: string
  workspacePath?: string
}

// Event log type (matches server EventLog)
export interface EventLog {
  id: string
  createdAt: string
  events: RalphEvent[]
  metadata?: EventLogMetadata
}

// Task chat message type for task management conversations
export interface TaskChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

// Store State

export interface AppState {
  // Ralph process status
  ralphStatus: RalphStatus

  // Timestamp when Ralph started running (null if not running)
  runStartedAt: number | null

  // Initial task count when Ralph started (for progress tracking)
  initialTaskCount: number | null

  // Event stream from ralph
  events: RalphEvent[]

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
  taskChatLoading: boolean
  taskChatStreamingText: string

  // Iteration view state (null = show current/latest iteration)
  viewingIterationIndex: number | null

  // Task search filter
  taskSearchQuery: string

  // Closed tasks time filter
  closedTimeFilter: ClosedTasksTimeFilter
}

// Store Actions

export interface AppActions {
  // Ralph status
  setRalphStatus: (status: RalphStatus) => void

  // Events
  addEvent: (event: RalphEvent) => void
  clearEvents: () => void

  // Tasks
  setTasks: (tasks: Task[]) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  clearTasks: () => void
  refreshTasks: () => Promise<void>

  // Workspace
  setWorkspace: (workspace: string | null) => void

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
  clearTaskChatMessages: () => void
  setTaskChatLoading: (loading: boolean) => void
  setTaskChatStreamingText: (text: string) => void
  appendTaskChatStreamingText: (text: string) => void

  // Iteration view
  setViewingIterationIndex: (index: number | null) => void
  goToPreviousIteration: () => void
  goToNextIteration: () => void
  goToLatestIteration: () => void

  // Task search
  setTaskSearchQuery: (query: string) => void
  clearTaskSearchQuery: () => void

  // Closed time filter
  setClosedTimeFilter: (filter: ClosedTasksTimeFilter) => void

  // Reset
  reset: () => void
}

// Iteration boundary helpers

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

// Initial State

const defaultSidebarWidth = 320
const defaultTaskChatWidth = 400

const initialState: AppState = {
  ralphStatus: "stopped",
  runStartedAt: null,
  initialTaskCount: null,
  events: [],
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
  taskChatLoading: false,
  taskChatStreamingText: "",
  viewingIterationIndex: null,
  taskSearchQuery: "",
  closedTimeFilter: "past_day",
}

// Create the store with localStorage initialization
const getInitialStateWithPersistence = (): AppState => ({
  ...initialState,
  sidebarWidth: loadSidebarWidth(),
  taskChatWidth: loadTaskChatWidth(),
  closedTimeFilter: loadClosedTimeFilter(),
})

// Store

export const useAppStore = create<AppState & AppActions>(set => ({
  ...getInitialStateWithPersistence(),

  // Ralph status
  setRalphStatus: status =>
    set(state => ({
      ralphStatus: status,
      // Set runStartedAt when transitioning to running, clear when stopped
      runStartedAt:
        status === "running" && state.ralphStatus !== "running" ? Date.now()
        : status === "stopped" ? null
        : state.runStartedAt,
      // Set initialTaskCount when transitioning to running, clear when stopped
      initialTaskCount:
        status === "running" && state.ralphStatus !== "running" ? state.tasks.length
        : status === "stopped" ? null
        : state.initialTaskCount,
    })),

  // Events
  addEvent: event =>
    set(state => ({
      events: [...state.events, event],
    })),

  clearEvents: () => set({ events: [] }),

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

  // Accent color
  setAccentColor: color => set({ accentColor: color }),

  // Branch
  setBranch: branch => set({ branch }),

  // Issue prefix
  setIssuePrefix: prefix => set({ issuePrefix: prefix }),

  // Token usage
  setTokenUsage: usage => set({ tokenUsage: usage }),
  addTokenUsage: usage =>
    set(state => ({
      tokenUsage: {
        input: state.tokenUsage.input + usage.input,
        output: state.tokenUsage.output + usage.output,
      },
    })),

  // Context window
  setContextWindow: contextWindow => set({ contextWindow }),
  updateContextWindowUsed: used =>
    set(state => ({
      contextWindow: { ...state.contextWindow, used },
    })),

  // Iteration
  setIteration: iteration => set({ iteration }),

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
  setTaskChatOpen: open => set({ taskChatOpen: open }),
  toggleTaskChat: () => set(state => ({ taskChatOpen: !state.taskChatOpen })),
  setTaskChatWidth: width => {
    saveTaskChatWidth(width)
    set({ taskChatWidth: width })
  },
  addTaskChatMessage: message =>
    set(state => ({
      taskChatMessages: [...state.taskChatMessages, message],
    })),
  clearTaskChatMessages: () => set({ taskChatMessages: [] }),
  setTaskChatLoading: loading => set({ taskChatLoading: loading }),
  setTaskChatStreamingText: text => set({ taskChatStreamingText: text }),
  appendTaskChatStreamingText: text =>
    set(state => ({ taskChatStreamingText: state.taskChatStreamingText + text })),

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

  // Closed time filter
  setClosedTimeFilter: filter => {
    saveClosedTimeFilter(filter)
    set({ closedTimeFilter: filter })
  },

  // Reset
  reset: () => set(initialState),
}))

// Selectors

export const selectRalphStatus = (state: AppState) => state.ralphStatus
export const selectRunStartedAt = (state: AppState) => state.runStartedAt
export const selectInitialTaskCount = (state: AppState) => state.initialTaskCount
export const selectEvents = (state: AppState) => state.events
export const selectTasks = (state: AppState) => state.tasks
export const selectWorkspace = (state: AppState) => state.workspace
export const selectBranch = (state: AppState) => state.branch
export const selectIssuePrefix = (state: AppState) => state.issuePrefix
export const selectTokenUsage = (state: AppState) => state.tokenUsage
export const selectContextWindow = (state: AppState) => state.contextWindow
export const selectIteration = (state: AppState) => state.iteration
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
export const selectTaskChatLoading = (state: AppState) => state.taskChatLoading
export const selectTaskChatStreamingText = (state: AppState) => state.taskChatStreamingText
export const selectViewingIterationIndex = (state: AppState) => state.viewingIterationIndex
export const selectIterationCount = (state: AppState) => countIterations(state.events)
export const selectCurrentIterationEvents = (state: AppState) =>
  getEventsForIteration(state.events, state.viewingIterationIndex)
export const selectIsViewingLatestIteration = (state: AppState) =>
  state.viewingIterationIndex === null
export const selectTaskSearchQuery = (state: AppState) => state.taskSearchQuery
export const selectClosedTimeFilter = (state: AppState) => state.closedTimeFilter
