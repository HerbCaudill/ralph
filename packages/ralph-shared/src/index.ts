// Ralph-specific event types, guards, and parsers
export {
  isRalphTaskStartedEvent,
  isRalphTaskCompletedEvent,
  parseTaskLifecycleEvent,
  parsePromiseCompleteEvent,
} from "./events/index"
export type {
  BaseChatEvent,
  RalphTaskStartedChatEvent,
  RalphTaskCompletedChatEvent,
  RalphSessionStartChatEvent,
  RalphSessionEndChatEvent,
  TaskLifecycleChatEvent,
  PromiseCompleteChatEvent,
} from "./events/index"

// NOTE: persistence/SessionPersister and persistence/getDefaultStorageDir are
// server-only exports available at @herbcaudill/ralph-shared/server
// They use Node.js APIs (fs, os) that break browser builds.
