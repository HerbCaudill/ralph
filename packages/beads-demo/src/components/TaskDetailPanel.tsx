import { IconChecklist } from "@tabler/icons-react"
import { TaskDetailsController, updateTask, deleteTask } from "@herbcaudill/beads-view"
import type { TaskCardTask, TaskUpdateData } from "@herbcaudill/beads-view"

export type TaskDetailPanelProps = {
  task: TaskCardTask | null
  open: boolean
  onClose: () => void
  onChanged: () => void
}

/**
 * Panel displaying task details with inline editing.
 * Wraps the TaskDetailsController from beads-view.
 */
export function TaskDetailPanel({ task, open, onClose, onChanged }: TaskDetailPanelProps) {
  if (!open || !task) {
    return <EmptyState />
  }

  const handleSave = async (id: string, updates: TaskUpdateData) => {
    await updateTask(id, updates)
    onChanged()
  }

  const handleDelete = async (id: string) => {
    await deleteTask(id)
    onChanged()
    onClose()
  }

  return (
    <div className="h-full mx-auto max-w-2xl">
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

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <IconChecklist size={48} stroke={1.5} />
        <p className="text-center text-sm">Select a task from the sidebar to view details.</p>
      </div>
    </div>
  )
}
