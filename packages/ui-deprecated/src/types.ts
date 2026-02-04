// Re-export shared ChatEvent types from @herbcaudill/agent-view
export type {
  // Base types
  ChatEvent,
  // Discriminated event types
  UserMessageChatEvent,
  UserChatEvent,
  AssistantChatEvent,
  StreamChatEvent,
  StreamEventPayload,
  ResultChatEvent,
  ErrorChatEvent,
  ToolUseChatEvent,
  RalphTaskStartedChatEvent,
  RalphTaskCompletedChatEvent,
  RalphSessionStartChatEvent,
  RalphSessionEndChatEvent,
  SystemChatEvent,
  AssistantTextChatEvent,
  TaskLifecycleChatEvent,
  PromiseCompleteChatEvent,
  // Content block types
  AssistantTextContentBlock,
  AssistantThinkingContentBlock,
  AssistantToolUseContentBlock,
  AssistantContentBlock,
  StreamingTextBlock,
  StreamingThinkingBlock,
  StreamingToolUseBlock,
  StreamingContentBlock,
  StreamingMessage,
  // Other shared types
  TokenUsage,
  ContextWindow,
  DiffLine,
  ToolName,
  AgentViewLinkHandlers,
  AgentViewToolOutputControl,
  AgentViewContextValue,
  AgentViewTask,
  // Deprecated aliases
  AssistantTextEvent,
  UserMessageEvent,
  TaskLifecycleEventData,
  ErrorEventData,
  ToolUseEvent,
} from "@herbcaudill/agent-view"
export type {
  ClosedTasksTimeFilter,
  TaskStatus,
  TaskDependency,
  Task,
  TaskCardTask,
  TaskUpdateData,
  TaskGroup,
  RelatedTask,
  Comment,
  TaskTreeNode,
} from "@herbcaudill/beads-view"

// UI-specific imports
import type { ThemeMeta } from "@herbcaudill/agent-view-theme"
import type { HotkeyAction, HotkeyConfig } from "@/config"

// UI-specific types

export type RalphStatus =
  | "stopped"
  | "starting"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopping_after_current"

export type Theme = "system" | "light" | "dark"

export interface SessionInfo {
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
  events: import("@herbcaudill/agent-view").ChatEvent[]
  metadata?: EventLogMetadata
}

export interface TaskChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  /** Sequence number for ordering within a turn (lower = earlier) */
  sequence?: number
}

export interface TaskChatToolUse {
  toolUseId: string
  tool: string
  input: Record<string, unknown>
  output?: string
  error?: string
  status: "pending" | "running" | "success" | "error"
  /** Timestamp when this tool use was created on the server */
  timestamp: number
  /** Sequence number for ordering within a turn (lower = earlier) */
  sequence?: number
}

export interface ThemeGroup {
  type: "dark" | "light"
  themes: ThemeMeta[]
}

export interface HotkeyCategory {
  name: string
  hotkeys: Array<{ action: HotkeyAction; config: HotkeyConfig }>
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

/**  Information about a merge conflict for an instance. */
export interface MergeConflict {
  /** Files with conflicts that need resolution */
  files: string[]
  /** Branch being merged from */
  sourceBranch: string
  /** Timestamp when the conflict was detected */
  timestamp: number
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
  events: import("@herbcaudill/agent-view").ChatEvent[]

  /** Token usage for this instance */
  tokenUsage: import("@herbcaudill/agent-view").TokenUsage

  /** Context window usage for this instance */
  contextWindow: import("@herbcaudill/agent-view").ContextWindow

  /** Session progress for this instance */
  session: SessionInfo

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

  /** Merge conflict info if instance is paused due to merge conflicts (null if no conflict) */
  mergeConflict: MergeConflict | null
}

/**
 * Serialized instance metadata from the server.
 * Contains only persistent/identity fields, not runtime state like events.
 */
export interface SerializedInstance {
  id: string
  name: string
  agentName: string
  worktreePath: string | null
  branch: string | null
  createdAt: number
  currentTaskId: string | null
  status: RalphStatus
  mergeConflict: MergeConflict | null
}
