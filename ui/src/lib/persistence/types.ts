/**
 * Persistence types for IndexedDB storage of sessions and task chat sessions.
 *
 * These types define the data structures stored in IndexedDB for offline persistence
 * and reconnection support.
 */

import type { ChatEvent, TokenUsage, ContextWindow, SessionInfo, TaskChatMessage } from "@/types"

/**
 * Metadata about a persisted session.
 * Used for listing/browsing sessions without loading full event data.
 */
export interface SessionMetadata {
  /** Unique identifier for the session (e.g., "default-1706123456789") */
  id: string

  /** ID of the Ralph instance this session belongs to */
  instanceId: string

  /** Path to the workspace this session belongs to (for cross-workspace queries) */
  workspaceId: string | null

  /** Timestamp when the session started */
  startedAt: number

  /** Timestamp when the session completed (null if still in progress) */
  completedAt: number | null

  /** ID of the task being worked on during this session (if any) */
  taskId: string | null

  /** Token usage at the end of this session */
  tokenUsage: TokenUsage

  /** Context window usage at the end of this session */
  contextWindow: ContextWindow

  /** Session progress info */
  session: SessionInfo

  /** Total number of events in this session */
  eventCount: number

  /** Last event sequence number received from server (for reconnection sync) */
  lastEventSequence: number
}

/**
 * Full persisted session data.
 * Events are stored separately in the events table and fetched via join.
 */
export interface PersistedSession extends SessionMetadata {
  /**
   * Events for this session.
   * Note: Events are stored separately in the events table.
   * This field is optional and only used for backward compatibility with test data.
   */
  events?: ChatEvent[]
}

/**
 * Metadata about a persisted event.
 * Used for listing/browsing events without loading full event data.
 */
export interface EventMetadata {
  /** Unique identifier for the event (e.g., "session-123-event-0") */
  id: string

  /** ID of the session this event belongs to */
  sessionId: string

  /** Timestamp when the event occurred */
  timestamp: number

  /** Event type for filtering (e.g., "user", "assistant", "tool_use") */
  eventType: string
}

/**
 * Full persisted event data.
 * Stored in the events object store for append-only writes.
 */
export interface PersistedEvent extends EventMetadata {
  /** The full event data */
  event: ChatEvent
}

/**
 * Metadata about a persisted task chat session.
 * Used for listing/browsing sessions without loading full message/event data.
 */
export interface TaskChatSessionMetadata {
  /** Unique identifier for the session (e.g., "default-taskchat-1706123456789") */
  id: string

  /** ID of the Ralph instance this session belongs to */
  instanceId: string

  /**
   * ID of the task this chat session was associated with.
   * @deprecated Task chat sessions are no longer tied to specific tasks.
   * This field exists for backward compatibility with older persisted data.
   */
  taskId?: string | null

  /**
   * Title of the task (for display without fetching task data).
   * @deprecated Task chat sessions are no longer tied to specific tasks.
   * This field exists for backward compatibility with older persisted data.
   */
  taskTitle?: string | null

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
 * Full persisted task chat session data including all messages.
 * Stored in IndexedDB for offline access and reconnection.
 * Events are stored separately in the events table and fetched via join.
 */
export interface PersistedTaskChatSession extends TaskChatSessionMetadata {
  /** All messages in this task chat session */
  messages: TaskChatMessage[]

  /**
   * Events for this task chat session.
   * Note: Events are stored separately in the events table.
   * This field is optional and only used for backward compatibility with test data.
   */
  events?: ChatEvent[]
}

/**
 * Database schema version.
 * When this changes, users must clear IndexedDB (no migration support).
 */
export const PERSISTENCE_SCHEMA_VERSION = 7

/**  IndexedDB store names. */
export const STORE_NAMES = {
  /** Store for session data */
  SESSIONS: "sessions",

  /** Store for individual events (normalized from sessions) */
  EVENTS: "events",

  /** Store for task chat session data including messages */
  CHAT_SESSIONS: "chat_sessions",

  /** Store for key-value settings and sync state */
  SYNC_STATE: "sync_state",
} as const

/**  Keys used in the sync state store. */
export const SYNC_STATE_KEYS = {
  /** Last successful sync timestamp */
  LAST_SYNC_TIMESTAMP: "last_sync_timestamp",

  /** ID of the currently active session */
  ACTIVE_SESSION_ID: "active_session_id",

  /** ID of the currently active task chat session */
  ACTIVE_TASK_CHAT_SESSION_ID: "active_task_chat_session_id",
} as const

/**  Type for sync state key-value pairs. */
export interface SyncState {
  key: string
  value: string | number | null
}
