/**
 * Persistence types for IndexedDB storage of iterations and task chat sessions.
 *
 * These types define the data structures stored in IndexedDB for offline persistence
 * and reconnection support.
 */

import type { ChatEvent, TokenUsage, ContextWindow, IterationInfo, TaskChatMessage } from "@/types"

/**
 * Metadata about a persisted event log.
 * Used for listing/browsing event logs without loading full event data.
 * These are standalone event logs saved from completed iterations.
 */
export interface EventLogMetadata {
  /** Unique identifier for the event log */
  id: string

  /** ID of the task this event log is associated with (optional) */
  taskId: string | null

  /** Title of the task (for display without fetching task data) */
  taskTitle: string | null

  /** Source description (e.g., "iteration", "task-chat") */
  source: string | null

  /** Path to the workspace (for display purposes) */
  workspacePath: string | null

  /** Timestamp when the event log was created */
  createdAt: number

  /** Total number of events in this log */
  eventCount: number
}

/**
 * Full persisted event log data including all events.
 * Stored in IndexedDB for viewing saved iteration event logs.
 */
export interface PersistedEventLog extends EventLogMetadata {
  /** All events in this log */
  events: ChatEvent[]
}

/**
 * Metadata about a persisted iteration.
 * Used for listing/browsing iterations without loading full event data.
 */
export interface IterationMetadata {
  /** Unique identifier for the iteration (e.g., "default-1706123456789") */
  id: string

  /** ID of the Ralph instance this iteration belongs to */
  instanceId: string

  /** Timestamp when the iteration started */
  startedAt: number

  /** Timestamp when the iteration completed (null if still in progress) */
  completedAt: number | null

  /** ID of the task being worked on during this iteration (if any) */
  taskId: string | null

  /** Title of the task being worked on (for display without fetching task data) */
  taskTitle: string | null

  /** Token usage at the end of this iteration */
  tokenUsage: TokenUsage

  /** Context window usage at the end of this iteration */
  contextWindow: ContextWindow

  /** Iteration progress info */
  iteration: IterationInfo

  /** Total number of events in this iteration */
  eventCount: number

  /** Last event sequence number received from server (for reconnection sync) */
  lastEventSequence: number
}

/**
 * Full persisted iteration data including all events.
 * Stored in IndexedDB for offline access and reconnection.
 */
export interface PersistedIteration extends IterationMetadata {
  /** All events for this iteration */
  events: ChatEvent[]
}

/**
 * Metadata about a persisted task chat session.
 * Used for listing/browsing sessions without loading full message/event data.
 */
export interface TaskChatSessionMetadata {
  /** Unique identifier for the session (e.g., "task-abc123-1706123456789") */
  id: string

  /** ID of the task this chat session is associated with */
  taskId: string

  /** Title of the task (for display without fetching task data) */
  taskTitle: string | null

  /** ID of the Ralph instance this session belongs to */
  instanceId: string

  /** Timestamp when the session was created */
  createdAt: number

  /** Timestamp when the session was last updated */
  updatedAt: number

  /** Total number of messages in this session */
  messageCount: number

  /** Total number of events in this session */
  eventCount: number

  /** Last event sequence number received from server (for reconnection sync) */
  lastEventSequence: number
}

/**
 * Full persisted task chat session data including all messages and events.
 * Stored in IndexedDB for offline access and reconnection.
 */
export interface PersistedTaskChatSession extends TaskChatSessionMetadata {
  /** All messages in this task chat session */
  messages: TaskChatMessage[]

  /** All events in this task chat session */
  events: ChatEvent[]
}

/**  Database schema version for migrations. */
export const PERSISTENCE_SCHEMA_VERSION = 2

/**  IndexedDB store names. */
export const STORE_NAMES = {
  /** Store for iteration metadata (for fast listing) */
  ITERATION_METADATA: "iteration_metadata",

  /** Store for full iteration data including events */
  ITERATIONS: "iterations",

  /** Store for task chat session metadata (for fast listing) */
  TASK_CHAT_METADATA: "task_chat_metadata",

  /** Store for full task chat session data including messages and events */
  TASK_CHAT_SESSIONS: "task_chat_sessions",

  /** Store for event log metadata (for fast listing) */
  EVENT_LOG_METADATA: "event_log_metadata",

  /** Store for full event log data including events */
  EVENT_LOGS: "event_logs",

  /** Store for key-value settings and sync state */
  SYNC_STATE: "sync_state",
} as const

/**  Keys used in the sync state store. */
export const SYNC_STATE_KEYS = {
  /** Last successful sync timestamp */
  LAST_SYNC_TIMESTAMP: "last_sync_timestamp",

  /** ID of the currently active iteration */
  ACTIVE_ITERATION_ID: "active_iteration_id",

  /** ID of the currently active task chat session */
  ACTIVE_TASK_CHAT_SESSION_ID: "active_task_chat_session_id",
} as const

/**  Type for sync state key-value pairs. */
export interface SyncState {
  key: string
  value: string | number | null
}
