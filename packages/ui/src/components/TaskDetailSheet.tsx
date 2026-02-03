import * as Dialog from "@radix-ui/react-dialog"
import { IconX } from "@tabler/icons-react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"
import { cn } from "../lib/utils"

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

/**
 * Sheet overlay for task details.
 * Slides in from the right side and displays TaskDetailsController.
 */
export function TaskDetailSheet({ task, open, onClose, onChanged }: TaskDetailSheetProps) {
  const handleSave = async (id: string, updates: TaskUpdateData) => {
    await updateTask(id, updates)
    onChanged()
  }

  const handleDelete = async (id: string) => {
    await deleteTask(id)
    onChanged()
    onClose()
  }

  // Don't render if no task or not open
  if (!open || !task) {
    return null
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-[400px] max-w-[90vw]",
            "bg-background border-l border-border shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-200 ease-out",
          )}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-medium truncate flex-1">
                {task.title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Close"
                >
                  <IconX size={18} stroke={1.5} />
                </button>
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              <TaskDetailsController
                task={task}
                open={open}
                onClose={onClose}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
