import type { ChatEvent } from "@herbcaudill/agent-view"

/** Event types that the Claude CLI emits and this adapter recognizes. */
const KNOWN_EVENT_TYPES = new Set([
  "assistant",
  "stream_event",
  "user",
  "user_message",
  "result",
  "error",
  "server_error",
  "system",
  "tool_use",
  "ralph_task_started",
  "ralph_task_completed",
  "ralph_session_start",
  "ralph_session_end",
  "task_lifecycle",
  "promise_complete",
  "assistant_text",
  "text",
])

/**
 * Convert a single native Claude CLI JSON event into zero or more ChatEvents.
 *
 * Claude CLI events already use the same shape as ChatEvent, so this is
 * essentially a pass-through that preserves the `timestamp` field if present
 * and filters out unrecognized event types.
 */
export const convertClaudeEvent = (
  /** The native event from the Claude CLI (parsed JSON object). */
  nativeEvent: unknown,
): ChatEvent[] => {
  if (nativeEvent == null || typeof nativeEvent !== "object") {
    return []
  }

  const event = nativeEvent as Record<string, unknown>
  const type = event.type

  if (typeof type !== "string" || !KNOWN_EVENT_TYPES.has(type)) {
    return []
  }

  const timestamp = typeof event.timestamp === "number" ? event.timestamp : undefined

  const chatEvent: ChatEvent = {
    ...event,
    type,
    timestamp,
  }

  // Normalize result usage fields for convenience
  if (type === "result" && event.usage != null && typeof event.usage === "object") {
    const usage = event.usage as Record<string, unknown>
    chatEvent.usage = {
      ...usage,
      inputTokens: usage.inputTokens ?? usage.input_tokens,
      outputTokens: usage.outputTokens ?? usage.output_tokens,
      input_tokens: usage.input_tokens ?? usage.inputTokens,
      output_tokens: usage.output_tokens ?? usage.outputTokens,
    }
  }

  return [chatEvent]
}
