import type { PromiseCompleteChatEvent } from "./types"

/**
 * Parse a text message to detect promise complete events.
 * Returns PromiseCompleteChatEvent if the text matches the pattern, null otherwise.
 *
 * Only matches when the marker appears at the end of the text block (with optional
 * trailing whitespace). This prevents false positives when the agent discusses code
 * that mentions the `<promise>COMPLETE</promise>` pattern mid-sentence.
 */
export function parsePromiseCompleteEvent(
  /** The text message to parse */
  text: string,
  /** Timestamp for the event */
  timestamp: number | undefined,
): PromiseCompleteChatEvent | null {
  if (/<promise>COMPLETE<\/promise>\s*$/i.test(text)) {
    return {
      type: "promise_complete",
      timestamp,
    }
  }

  return null
}
