export async function sendTaskChatMessage(
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/task-chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message" }
  }
}
