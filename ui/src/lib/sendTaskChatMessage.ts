import type { TaskChatMessage } from "@/types"

/**
 * Simplified message format for sending history to the server.
 * Only includes fields needed for conversation context.
 */
interface MessageHistoryItem {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

/**
 * Converts client TaskChatMessage to simplified format for server.
 */
function toHistoryItem(msg: TaskChatMessage): MessageHistoryItem {
  return {
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }
}

/**
 * Send a message to the task chat, including conversation history.
 *
 * @param message - The user's message
 * @param history - Previous conversation messages (client-authoritative)
 */
export async function sendTaskChatMessage(
  message: string,
  history: TaskChatMessage[] = [],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/task-chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.map(toHistoryItem),
      }),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message" }
  }
}
