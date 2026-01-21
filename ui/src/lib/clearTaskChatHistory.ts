export async function clearTaskChatHistory(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/task-chat/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to clear history" }
  }
}
