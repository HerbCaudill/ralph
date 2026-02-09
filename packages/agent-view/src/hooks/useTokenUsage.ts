import { useMemo } from "react"
import { aggregateTokenUsage } from "../lib/extractTokenUsage"
import type { ChatEvent, TokenUsage } from "../types"

/** Default context window maximum (200k tokens). */
const DEFAULT_CONTEXT_WINDOW_MAX = 200_000

/**
 * Derive current token usage from the most recent usage event.
 * Input tokens represent the current context window size; output tokens are from the latest turn.
 */
export function useTokenUsage(
  /** Events to extract the latest token usage from */
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
