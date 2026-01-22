import type { ThreadEvent } from "@openai/codex-sdk"

/**
 * Create a mock async iterable stream of thread events for testing.
 * Yields each event in sequence.
 */
export function createEventStream(
  /** The events to stream */
  events: ThreadEvent[],
) {
  async function* stream() {
    for (const event of events) {
      yield event
    }
  }
  return stream()
}
