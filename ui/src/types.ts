import type { ThemeMeta } from "@/lib/theme"
import type { HotkeyAction, HotkeyConfig } from "@/config"

export type ClosedTasksTimeFilter = "past_hour" | "past_day" | "past_week" | "all_time"

export type RalphStatus =
  | "stopped"
  | "starting"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopping_after_current"

export type Theme = "system" | "light" | "dark"

export interface RalphEvent {
  type: string
  timestamp: number
  [key: string]: unknown
}

export type TaskStatus = "open" | "in_progress" | "blocked" | "deferred" | "closed"

export interface TaskDependency {
  id: string
  status: TaskStatus
  dependency_type: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority?: number
  issue_type?: string
  parent?: string
  created_at?: string
  closed_at?: string
  dependencies?: TaskDependency[]
  /** IDs of issues that block this issue (from bd blocked command) */
  blocked_by?: string[]
  /** Number of issues blocking this issue (from bd blocked command) */
  blocked_by_count?: number
}

export type TaskCardTask = Task & {
  labels?: string[]
}

export interface TokenUsage {
  input: number
  output: number
}

export interface ContextWindow {
  used: number
  max: number
}

export interface IterationInfo {
  current: number
  total: number
}

export interface EventLogMetadata {
  taskId?: string
  title?: string
  source?: string
  workspacePath?: string
}

export interface EventLog {
  id: string
  createdAt: string
  events: RalphEvent[]
  metadata?: EventLogMetadata
}

export interface TaskChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export interface TaskChatToolUse {
  toolUseId: string
  tool: string
  input: Record<string, unknown>
  output?: string
  error?: string
  status: "pending" | "running" | "success" | "error"
  timestamp?: number
}

export type TaskUpdateData = {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: number
  type?: string
  parent?: string | null
}

export interface AssistantTextEvent {
  type: "assistant_text" | "text"
  timestamp: number
  content: string
}

export interface UserMessageEvent {
  type: "user_message"
  timestamp: number
  message: string
}

export interface TaskLifecycleEventData {
  type: "task_lifecycle"
  timestamp: number
  action: "starting" | "completed"
  taskId: string
  taskTitle?: string
}

export interface ErrorEventData {
  type: "error" | "server_error"
  timestamp: number
  error: string
}

export type ToolName =
  | "Read"
  | "Edit"
  | "Write"
  | "Bash"
  | "Grep"
  | "Glob"
  | "WebSearch"
  | "WebFetch"
  | "TodoWrite"
  | "Task"

export interface ToolUseEvent {
  type: "tool_use"
  timestamp: number
  tool: ToolName
  input?: Record<string, unknown>
  output?: string
  status?: "pending" | "running" | "success" | "error"
  duration?: number
  error?: string
}

export interface AssistantTextContentBlock {
  type: "text"
  text: string
}

export interface AssistantToolUseContentBlock {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}

export type AssistantContentBlock = AssistantTextContentBlock | AssistantToolUseContentBlock

export interface StreamingTextBlock {
  type: "text"
  text: string
}

export interface StreamingToolUseBlock {
  type: "tool_use"
  id: string
  name: string
  input: string
}

export type StreamingContentBlock = StreamingTextBlock | StreamingToolUseBlock

export interface StreamingMessage {
  timestamp: number
  contentBlocks: StreamingContentBlock[]
}

export type TaskGroup = "open" | "closed"

export interface RelatedTask {
  id: string
  title: string
  status: TaskStatus
  dependency_type?: string
}

export interface ThemeGroup {
  type: "dark" | "light"
  themes: ThemeMeta[]
}

export interface HotkeyCategory {
  name: string
  hotkeys: Array<{ action: HotkeyAction; config: HotkeyConfig }>
}

export interface DiffLine {
  type: "context" | "added" | "removed"
  lineOld?: number
  lineNew?: number
  content: string
}

export interface Comment {
  id: number
  issue_id: string
  author: string
  text: string
  created_at: string
}

export interface WorkspaceInfo {
  path: string
  name: string
  issueCount?: number
  daemonConnected?: boolean
  daemonStatus?: string
  accentColor?: string | null
  branch?: string | null
  issuePrefix?: string | null
}

export interface WorkspaceListEntry {
  path: string
  name: string
  database: string
  pid: number
  version: string
  startedAt: string
  isActive: boolean
  accentColor?: string | null
  activeIssueCount?: number
}

/**
 * Represents a single Ralph instance with its per-instance state.
 * Used for concurrent Ralph support where multiple instances can run simultaneously.
 */
export interface RalphInstance {
  /** Unique identifier for the instance */
  id: string

  /** Display name for the instance (e.g., "Main", "Worktree 1") */
  name: string

  /** Agent name/ID used for task assignment (e.g., "Ralph-1", "Ralph-2") */
  agentName: string

  /** Ralph process status */
  status: RalphStatus

  /** Event stream from Ralph for this instance */
  events: RalphEvent[]

  /** Token usage for this instance */
  tokenUsage: TokenUsage

  /** Context window usage for this instance */
  contextWindow: ContextWindow

  /** Iteration progress for this instance */
  iteration: IterationInfo

  /** Path to the git worktree (null for main workspace) */
  worktreePath: string | null

  /** Git branch name for this instance */
  branch: string | null

  /** ID of the current task being worked on */
  currentTaskId: string | null

  /** Timestamp when the instance was created */
  createdAt: number

  /** Timestamp when Ralph started running (null if not running) */
  runStartedAt: number | null
}
