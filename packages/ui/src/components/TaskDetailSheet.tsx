import { useCallback, useEffect, useRef } from "react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"

/**
 * Slide-out panel for task details.
 * Positioned absolutely on the right side of its parent container,
 * overlaying content without a dark backdrop.
 * Dismissible via Escape key or clicking outside.
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

  // Close on Escape key
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

  // Close on click outside the panel
  useEffect(() => {
    if (!open || !onClose) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target) return
      if (panelRef.current?.contains(target)) return
      // Don't close when clicking inside Radix portals (e.g. dropdowns, popovers)
      if (target.closest("[data-radix-popper-content-wrapper]")) return
      onClose()
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [open, onClose])

  const isVisible = open && task !== null

  if (!isVisible) return null

  return (
    <div
      ref={panelRef}
      data-testid="task-detail-sheet"
      className="animate-slide-out-right bg-background absolute top-0 left-0 h-full overflow-y-auto border-r border-border shadow-lg"
      style={{ width: PANEL_WIDTH }}
      onClick={e => e.stopPropagation()}
    >
      <TaskDetailsController
        task={task}
        open={open}
        onClose={onClose}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}

/** Width of the slide-out detail panel in pixels. */
const PANEL_WIDTH = 480

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
