import { useMemo } from "react"
import { aggregateTokenUsage } from "../lib/extractTokenUsage"
import type { ChatEvent, TokenUsage } from "../types"

/** Default context window maximum (200k tokens). */
const DEFAULT_CONTEXT_WINDOW_MAX = 200_000

/**
 * Derive aggregate token usage from an array of events.
 * Returns `{ input, output }` totals recomputed whenever events change.
 */
export function useTokenUsage(
  /** Events to aggregate token usage from */
  events: ChatEvent[],
): TokenUsage {
  return useMemo(() => aggregateTokenUsage(events), [events])
}

/**
 * Derive context window progress from an array of events.
 * Returns `{ used, max }` where used = input + output tokens.
 */
export function useContextWindow(
  /** Events to aggregate token usage from */
  events: ChatEvent[],
  /** Maximum context window size in tokens */
  max: number = DEFAULT_CONTEXT_WINDOW_MAX,
): ContextWindowState {
  const tokenUsage = useTokenUsage(events)
  return useMemo(
    () => ({
      used: tokenUsage.input + tokenUsage.output,
      max,
    }),
    [tokenUsage.input, tokenUsage.output, max],
  )
}

type ContextWindowState = {
  used: number
  max: number
}
