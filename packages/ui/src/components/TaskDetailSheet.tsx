import { useEffect, useRef, useCallback } from "react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"
import { cn } from "../lib/utils"

/**
 * Slide-out panel for task details.
 * Absolutely positioned within the main content area, slides from behind the task list.
 * No modal overlay -- click outside closes the panel.
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

  /** Close when clicking outside the panel. */
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open, onClose])

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

  return (
    <div
      ref={panelRef}
      data-testid="task-detail-sheet"
      className={cn(
        "absolute right-0 top-0 z-40 h-full w-[400px] max-w-full",
        "bg-background border-l border-border shadow-lg",
        "transition-transform duration-200 ease-out",
        open && task ? "translate-x-0" : "translate-x-full",
      )}
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
