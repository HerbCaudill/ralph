import { type SDKMessage } from "@anthropic-ai/claude-agent-sdk"

/**  Convert SDK message to event format for display. */
export const sdkMessageToEvent = (
  /** The SDK message to convert */
  message: SDKMessage,
): Record<string, unknown> | null => {
  // Pass through messages that have the structure we expect
  if (message.type === "assistant" || message.type === "user" || message.type === "result") {
    return message as unknown as Record<string, unknown>
  }
  // Skip system and stream_event messages for display
  return null
}
