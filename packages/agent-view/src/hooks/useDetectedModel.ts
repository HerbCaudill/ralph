import { useMemo } from "react"
import type { ChatEvent } from "../types"
import { extractModelFromEvents } from "../lib/extractModelFromEvents"

/**
 * Extract the model name from the event stream.
 * Returns the model from the most recent turn_usage event.
 */
export function useDetectedModel(
  /** The events to search for model information. */
  events: ChatEvent[],
): string | undefined {
  return useMemo(() => extractModelFromEvents(events), [events])
}
