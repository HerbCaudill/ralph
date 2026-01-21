export async function cancelStopAfterCurrentRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/cancel-stop-after-current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel stop after current",
    }
  }
}
