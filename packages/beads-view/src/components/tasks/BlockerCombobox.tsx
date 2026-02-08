import { TaskRelationCombobox } from "./TaskRelationCombobox"
import type { Task } from "../../types"

/**
 * A combobox for selecting tasks to add as blockers.
 * Filters out the current task and any tasks that are already blockers.
 *
 * @deprecated Use TaskRelationCombobox with relationType="blocker" instead.
 */
export function BlockerCombobox({
  task,
  allTasks,
  issuePrefix,
  existingBlockerIds,
  onAdd,
  disabled = false,
}: Props) {
  return (
    <TaskRelationCombobox
      task={task}
      allTasks={allTasks}
      issuePrefix={issuePrefix}
      excludeIds={existingBlockerIds}
      relationType="blocker"
      onSelect={onAdd}
      disabled={disabled}
    />
  )
}

type Props = {
  task: Task
  allTasks: Task[]
  issuePrefix: string | null
  existingBlockerIds: string[]
  onAdd: (blockerId: string) => void
  disabled?: boolean
}
