import type {
  AgentEvent,
  AgentEventEnvelope,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
  AgentReconnectRequest,
  AgentPendingEventsResponse,
} from "./types.js"

/**  Check if an event is a message event. */
export function isAgentMessageEvent(event: AgentEvent): event is AgentMessageEvent {
  return event.type === "message"
}

/**  Check if an event is a thinking event. */
export function isAgentThinkingEvent(event: AgentEvent): event is AgentThinkingEvent {
  return event.type === "thinking"
}

/**  Check if an event is a tool use event. */
export function isAgentToolUseEvent(event: AgentEvent): event is AgentToolUseEvent {
  return event.type === "tool_use"
}

/**  Check if an event is a tool result event. */
export function isAgentToolResultEvent(event: AgentEvent): event is AgentToolResultEvent {
  return event.type === "tool_result"
}

/**  Check if an event is a result event. */
export function isAgentResultEvent(event: AgentEvent): event is AgentResultEvent {
  return event.type === "result"
}

/**  Check if an event is an error event. */
export function isAgentErrorEvent(event: AgentEvent): event is AgentErrorEvent {
  return event.type === "error"
}

/**  Check if an event is a status event. */
export function isAgentStatusEvent(event: AgentEvent): event is AgentStatusEvent {
  return event.type === "status"
}

/**  Check if a wire message is an agent event envelope. */
export function isAgentEventEnvelope(message: unknown): message is AgentEventEnvelope {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as Record<string, unknown>).type === "agent:event" &&
    "source" in message &&
    "instanceId" in message &&
    "event" in message
  )
}

/**  Check if a wire message is a unified reconnect request. */
export function isAgentReconnectRequest(message: unknown): message is AgentReconnectRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as Record<string, unknown>).type === "agent:reconnect" &&
    "source" in message &&
    "instanceId" in message
  )
}

/**  Check if a wire message is a unified pending events response. */
export function isAgentPendingEventsResponse(
  message: unknown,
): message is AgentPendingEventsResponse {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as Record<string, unknown>).type === "agent:pending_events" &&
    "source" in message &&
    "instanceId" in message &&
    "events" in message
  )
}
