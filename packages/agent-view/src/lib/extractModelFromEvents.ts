import type { ChatEvent } from "../types"

/**
 * Extract the most recent model name from a list of events.
 * The model is included in `turn_usage` events emitted by the ClaudeAdapter.
 */
export function extractModelFromEvents(
  /** The events to search. */
  events: ChatEvent[],
): string | undefined {
  // Search backwards for the most recent turn_usage event with a model
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.type === "turn_usage" && "model" in event && typeof event.model === "string") {
      return event.model
    }
  }
  return undefined
}
