/**
 * Type guards for canonical event types.
 *
 * These guards check the `type` discriminant field and narrow the
 * TypeScript type accordingly.
 */
import type {
  CanonicalEventType,
  ErrorEventType,
  MessageEventType,
  ResultEventType,
  StatusEventType,
  ThinkingEventType,
  ToolResultEventType,
  ToolUseEventType,
} from "./types.js"

/** Check if an event is a message event. */
export const isMessageEvent = (event: CanonicalEventType): event is MessageEventType =>
  event.type === "message"

/** Check if an event is a thinking event. */
export const isThinkingEvent = (event: CanonicalEventType): event is ThinkingEventType =>
  event.type === "thinking"

/** Check if an event is a tool use event. */
export const isToolUseEvent = (event: CanonicalEventType): event is ToolUseEventType =>
  event.type === "tool_use"

/** Check if an event is a tool result event. */
export const isToolResultEvent = (event: CanonicalEventType): event is ToolResultEventType =>
  event.type === "tool_result"

/** Check if an event is a result event. */
export const isResultEvent = (event: CanonicalEventType): event is ResultEventType =>
  event.type === "result"

/** Check if an event is an error event. */
export const isErrorEvent = (event: CanonicalEventType): event is ErrorEventType =>
  event.type === "error"

/** Check if an event is a status event. */
export const isStatusEvent = (event: CanonicalEventType): event is StatusEventType =>
  event.type === "status"

/** Check if an event is a known core type (not an unknown/custom event). */
export const isCoreEvent = (event: CanonicalEventType): boolean =>
  ["message", "thinking", "tool_use", "tool_result", "result", "error", "status"].includes(
    event.type
  )
