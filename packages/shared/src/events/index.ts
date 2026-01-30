export type {
  AgentEvent,
  AgentEventBase,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
  AgentStatus,
  AgentEventSource,
  AgentEventEnvelope,
  AgentReconnectRequest,
  AgentPendingEventsResponse,
} from "./types.js"

export {
  isAgentMessageEvent,
  isAgentThinkingEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
  isAgentEventEnvelope,
  isAgentReconnectRequest,
  isAgentPendingEventsResponse,
} from "./guards.js"

// Legacy backward compatibility (r-tufi7.51.5)
export {
  isLegacyWireType,
  isLegacyReconnectType,
  isLegacyPendingType,
  translateLegacyToEnvelope,
  translateLegacyReconnect,
  envelopeToLegacy,
  LEGACY_WIRE_TYPES,
  LEGACY_RECONNECT_TYPES,
  LEGACY_PENDING_TYPES,
} from "./legacyCompat.js"

export type { LegacyWireType, LegacyReconnectType, LegacyPendingType } from "./legacyCompat.js"
