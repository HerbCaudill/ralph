import { useAppStore } from "@/store"

export async function stopRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const instanceId = useAppStore.getState().activeInstanceId
    const response = await fetch(`/api/ralph/${instanceId}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to stop" }
  }
}
