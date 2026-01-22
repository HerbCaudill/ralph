import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"

/**
 * Create a mock async iterable stream of SDK messages for testing.
 * Yields each message in sequence.
 */
export function createMessageStream(
  /** The messages to stream */
  messages: SDKMessage[],
) {
  async function* stream() {
    for (const message of messages) {
      yield message
    }
  }
  return stream()
}
