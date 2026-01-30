import { TASK_LIST_PARENT_STORAGE_KEY } from "@/constants"

export function loadParentCollapsedState(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(TASK_LIST_PARENT_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as Record<string, boolean>
    }
  } catch {
    // Ignore parse errors
  }
  return null
}
