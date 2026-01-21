import { TASK_LIST_STATUS_STORAGE_KEY } from "@/constants"
import type { TaskGroup } from "@/types"

export function saveStatusCollapsedState(state: Record<TaskGroup, boolean>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(TASK_LIST_STATUS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}
