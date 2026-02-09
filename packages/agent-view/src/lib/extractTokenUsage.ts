import type { ChatEvent, TokenUsage } from "../types"

/**
 * Token usage data from Claude SDK message_delta events.
 * Uses snake_case as per the Claude API.
 */
interface MessageDeltaUsage {
  input_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  output_tokens?: number
}

/**
 * Token usage data from normalized adapter events.
 * Supports both camelCase (adapter) and snake_case (raw SDK) formats.
 */
interface NormalizedUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  input_tokens?: number
  output_tokens?: number
}

/**
 * Extract token usage from a single chat event.
 *
 * Handles two event formats:
 * 1. stream_event with nested message_delta (raw Claude SDK via CLI)
 * 2. result event with usage (adapter-normalized events)
 */
export function extractTokenUsageFromEvent(
  /** The event to extract usage from */
  event: ChatEvent,
): TokenUsage | null {
  // Handle stream_event with nested message_delta (raw Claude SDK format)
  if (event.type === "stream_event") {
    const streamEvent = event.event as { type?: string; usage?: MessageDeltaUsage } | undefined
    if (streamEvent?.type === "message_delta" && streamEvent.usage) {
      const usage = streamEvent.usage
      const inputTokens =
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0)
      const outputTokens = usage.output_tokens ?? 0

      if (inputTokens > 0 || outputTokens > 0) {
        return { input: inputTokens, output: outputTokens }
      }
    }
    return null
  }

  // Handle result events with usage (adapter-normalized format)
  if (event.type === "result") {
    const usage = event.usage as NormalizedUsage | undefined
    if (usage) {
      const inputTokens = usage.inputTokens ?? usage.input_tokens ?? 0
      const outputTokens = usage.outputTokens ?? usage.output_tokens ?? 0

      if (inputTokens > 0 || outputTokens > 0) {
        return { input: inputTokens, output: outputTokens }
      }
    }
    return null
  }

  // Handle per-turn usage events (emitted at each message_stop during multi-turn queries)
  if (event.type === "turn_usage") {
    const usage = event.usage as NormalizedUsage | undefined
    if (usage) {
      const inputTokens = usage.inputTokens ?? usage.input_tokens ?? 0
      const outputTokens = usage.outputTokens ?? usage.output_tokens ?? 0

      if (inputTokens > 0 || outputTokens > 0) {
        return { input: inputTokens, output: outputTokens }
      }
    }
    return null
  }

  return null
}

/**
 * Aggregate token usage across an array of events.
 * Useful for calculating total usage from a batch or reconstructing from history.
 */
export function aggregateTokenUsage(
  /** Events to aggregate token usage from */
  events: ChatEvent[],
): TokenUsage {
  const total: TokenUsage = { input: 0, output: 0 }

  for (const event of events) {
    const usage = extractTokenUsageFromEvent(event)
    if (usage) {
      total.input += usage.input
      total.output += usage.output
    }
  }

  return total
}
