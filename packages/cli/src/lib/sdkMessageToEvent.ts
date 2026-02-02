import { type SDKMessage } from "@anthropic-ai/claude-agent-sdk"

/**  Convert SDK message to event format for display. */
export const sdkMessageToEvent = (
  /** The SDK message to convert */
  message: SDKMessage,
): Record<string, unknown> | null => {
  // Pass through assistant and result messages for display.
  // User messages are NOT passed through because:
  // - The initial prompt doesn't need display (session header suffices)
  // - User-injected messages are added directly to events in handleUserMessageSubmit
  // - Sub-agent user messages (Task tool prompts) would repeat on every partial update
  if (message.type === "assistant" || message.type === "result") {
    return message as unknown as Record<string, unknown>
  }
  // Skip system and stream_event messages for display
  return null
}
