import { TASK_LIST_PARENT_STORAGE_KEY } from "@/constants"

export function saveParentCollapsedState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(TASK_LIST_PARENT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}
