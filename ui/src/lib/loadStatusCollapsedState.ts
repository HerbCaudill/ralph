import { TASK_LIST_STATUS_STORAGE_KEY } from "@/constants"
import type { TaskGroup } from "@/types"

export function loadStatusCollapsedState(): Record<TaskGroup, boolean> | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(TASK_LIST_STATUS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as Record<TaskGroup, boolean>
    }
  } catch {
    // Ignore parse errors
  }
  return null
}
