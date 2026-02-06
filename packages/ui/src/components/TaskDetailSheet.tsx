import { useEffect, useRef, useCallback } from "react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"
import { cn } from "../lib/utils"

/**
 * Side panel for task details.
 * Rendered inline beside the task list within a flex container --
 * it takes up space in the layout rather than overlaying the task list.
 * Close via Escape key or the close button in TaskDetailsController.
 */
export function TaskDetailSheet({ task, open, onClose, onChanged }: TaskDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

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

  /** Close on Escape key. */
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const isVisible = open && task !== null

  if (!isVisible) return null

  return (
    <div
      ref={panelRef}
      data-testid="task-detail-sheet"
      className={cn("h-full w-[400px] shrink-0", "bg-background border-l border-border")}
    >
      {task && (
        <>
          <span className="sr-only">{task.title}</span>
          <TaskDetailsController
            task={task}
            open={open}
            onClose={onClose}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
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
