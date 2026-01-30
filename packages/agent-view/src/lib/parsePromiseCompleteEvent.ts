import type { PromiseCompleteChatEvent } from "../types"

/**
 * Parse a text message to detect promise complete events.
 * Returns PromiseCompleteChatEvent if the text matches the pattern, null otherwise.
 *
 * Pattern recognized:
 * - "<promise>COMPLETE</promise>"
 */
export function parsePromiseCompleteEvent(
  /** The text message to parse */
  text: string,
  /** Timestamp for the event */
  timestamp: number | undefined,
): PromiseCompleteChatEvent | null {
  const match = text.match(/<promise>COMPLETE<\/promise>/i)
  if (match) {
    return {
      type: "promise_complete",
      timestamp,
    }
  }

  return null
}
