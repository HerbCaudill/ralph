import { useCallback } from "react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"
import { Sheet, SheetContent, SheetTitle } from "@herbcaudill/components"

/**
 * Overlay sheet for task details.
 * Opens from the right side of the screen, overlaying the Ralph panel.
 * Uses Radix UI Sheet via @herbcaudill/components for proper modal behavior.
 */
export function TaskDetailSheet({ task, open, onClose, onChanged }: TaskDetailSheetProps) {
  const handleSave = useCallback(
    async (id: string, updates: TaskUpdateData) => {
      await updateTask(id, updates)
      onChanged()
    },
    [onChanged],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteTask(id)
      onChanged()
      onClose()
    },
    [onChanged, onClose],
  )

  const isVisible = open && task !== null

  return (
    <Sheet open={isVisible} onOpenChange={isOpen => !isOpen && onClose()}>
      <SheetContent
        side="right"
        size="lg"
        data-testid="task-detail-sheet"
        className="flex flex-col overflow-hidden p-0"
      >
        <SheetTitle className="sr-only">{task?.title ?? "Task Details"}</SheetTitle>
        {task && (
          <TaskDetailsController
            task={task}
            open={open}
            onClose={onClose}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export type TaskDetailSheetProps = {
  /** The task to display/edit */
  task: TaskCardTask | null
  /** Whether the sheet is open */
  open: boolean
  /** Callback when close is requested */
  onClose: () => void
  /** Callback when task is changed (updated/deleted) */
  onChanged: () => void
}
