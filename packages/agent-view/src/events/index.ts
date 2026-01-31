/**
 * Canonical event schema, types, and guards.
 *
 * Re-exports everything from the events module for convenient imports.
 */

// Schema definitions (Effect Schema objects)
export {
  BaseEvent,
  CanonicalEvent,
  ErrorEvent,
  MessageEvent,
  ResultEvent,
  StatusEvent,
  ThinkingEvent,
  ToolResultEvent,
  ToolUseEvent,
  UnknownEvent,
} from "./schema.js"

// Inferred TypeScript types
export type {
  AgentStatus,
  BaseEventType,
  CanonicalEventEncoded,
  CanonicalEventType,
  ErrorEventType,
  MessageEventType,
  ResultEventType,
  StatusEventType,
  ThinkingEventType,
  ToolResultEventType,
  ToolUseEventType,
  UnknownEventType,
} from "./types.js"

// Type guards
export {
  isCoreEvent,
  isErrorEvent,
  isMessageEvent,
  isResultEvent,
  isStatusEvent,
  isThinkingEvent,
  isToolResultEvent,
  isToolUseEvent,
} from "./guards.js"
