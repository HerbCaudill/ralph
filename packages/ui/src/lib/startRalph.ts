import { useAppStore } from "@/store"

export async function startRalph(sessions?: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const instanceId = useAppStore.getState().activeInstanceId
    const response = await fetch(`/api/ralph/${instanceId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions }),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to start" }
  }
}
