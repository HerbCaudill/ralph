/**
 * Ralph-specific event types used by both CLI and UI.
 *
 * These extend the base ChatEvent interface from agent-view.
 * Since ralph-shared cannot depend on agent-view, we define a minimal
 * base interface here that is structurally compatible.
 */

/** Minimal base event interface, structurally compatible with agent-view's ChatEvent. */
export interface BaseChatEvent {
  type: string
  timestamp?: number
  id?: string
  [key: string]: unknown
}

/** Emitted when Ralph starts working on a task. */
export interface RalphTaskStartedChatEvent extends BaseChatEvent {
  type: "ralph_task_started"
  taskId?: string
  sessionId?: string
}

/** Emitted when Ralph finishes working on a task. */
export interface RalphTaskCompletedChatEvent extends BaseChatEvent {
  type: "ralph_task_completed"
  taskId?: string
  sessionId?: string
}

/** Emitted at the start of a Ralph session. */
export interface RalphSessionStartChatEvent extends BaseChatEvent {
  type: "ralph_session_start"
  sessionId?: string
}

/** Emitted at the end of a Ralph session. */
export interface RalphSessionEndChatEvent extends BaseChatEvent {
  type: "ralph_session_end"
  sessionId?: string
}

/** A task lifecycle event. */
export interface TaskLifecycleChatEvent extends BaseChatEvent {
  type: "task_lifecycle"
  action: "starting" | "completed"
  taskId: string
}

/** A promise complete event, emitted when a session signals completion. */
export interface PromiseCompleteChatEvent extends BaseChatEvent {
  type: "promise_complete"
}
