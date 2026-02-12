/**
 * Ralph-specific event types, guards, and parsers.
 */

// Types
export type {
  BaseChatEvent,
  RalphTaskStartedChatEvent,
  RalphTaskCompletedChatEvent,
  RalphSessionStartChatEvent,
  RalphSessionEndChatEvent,
  TaskLifecycleChatEvent,
  PromiseCompleteChatEvent,
} from "./types"

// Guards
export { isRalphTaskStartedEvent } from "./isRalphTaskStartedEvent"
export { isRalphTaskCompletedEvent } from "./isRalphTaskCompletedEvent"

// Parsers
export { parseTaskLifecycleEvent } from "./parseTaskLifecycleEvent"
export { parsePromiseCompleteEvent } from "./parsePromiseCompleteEvent"
