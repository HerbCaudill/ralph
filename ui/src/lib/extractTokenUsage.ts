/**
 * Pure functions for extracting token usage from Ralph events.
 *
 * This module extracts token counts from different event types:
 * - stream_event with message_delta.usage (from raw Claude SDK)
 * - result events with usage (from ClaudeAdapter normalized events)
 *
 * The extraction logic is separated from WebSocket handling to:
 * 1. Make the code more testable
 * 2. Allow for easier debugging
 * 3. Centralize token extraction in one place
 */

import type { TokenUsage } from "@/types"

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
 * Token usage data from ClaudeAdapter normalized events.
 * Uses camelCase as per the adapter's normalized format.
 */
interface NormalizedUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  // Also support snake_case for raw SDK events
  input_tokens?: number
  output_tokens?: number
}

/**
 * A Ralph event that may contain token usage data.
 */
export interface RalphEvent {
  type: string
  timestamp: number
  [key: string]: unknown
}

/**
 * Extract token usage from a single Ralph event.
 *
 * Handles two event formats:
 * 1. stream_event with nested message_delta (from raw Claude SDK via ralph CLI)
 *    Structure: { type: "stream_event", event: { type: "message_delta", usage: {...} } }
 *
 * 2. result event with usage (from ClaudeAdapter normalized events)
 *    Structure: { type: "result", usage: { inputTokens, outputTokens } }
 *
 * @param event - The Ralph event to extract usage from
 * @returns TokenUsage with input/output counts, or null if no usage found
 */
export function extractTokenUsageFromEvent(event: RalphEvent): TokenUsage | null {
  // Handle stream_event with nested message_delta (raw Claude SDK format)
  if (event.type === "stream_event") {
    const streamEvent = event.event as { type?: string; usage?: MessageDeltaUsage } | undefined
    if (streamEvent?.type === "message_delta" && streamEvent.usage) {
      const usage = streamEvent.usage
      // Calculate total input tokens (base + cache creation + cache read)
      // All these contribute to the input token count
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

  // Handle result events with usage (ClaudeAdapter normalized format)
  if (event.type === "result") {
    const usage = event.usage as NormalizedUsage | undefined
    if (usage) {
      // Support both camelCase (from ClaudeAdapter) and snake_case (from raw SDK)
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
 *
 * Useful for calculating total usage from a batch of events,
 * or for reconstructing usage totals from event history.
 *
 * @param events - Array of Ralph events to aggregate
 * @returns TokenUsage with summed input/output counts
 */
export function aggregateTokenUsage(events: RalphEvent[]): TokenUsage {
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
