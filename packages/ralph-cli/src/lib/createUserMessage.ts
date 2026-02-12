import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

/**  Create an SDKUserMessage from text. */
export const createUserMessage = (
  /** The text content of the message */
  text: string,
): SDKUserMessage => ({
  type: "user",
  session_id: "",
  message: {
    role: "user",
    content: [{ type: "text", text }],
  },
  parent_tool_use_id: null,
})
