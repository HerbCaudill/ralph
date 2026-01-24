import type { TaskDialogContextValue } from "@/contexts"

/**
 * Handle clicking a task ID to open its detail dialog.
 * Only opens if taskId is non-null and context is available.
 */
export function handleTaskClick(
  /** The task ID to open */
  taskId: string | null,
  /** The task dialog context */
  taskDialogContext: TaskDialogContextValue | null,
) {
  if (!taskId) return
  if (taskDialogContext) {
    taskDialogContext.openTaskById(taskId)
  }
}
