import { useState, useMemo } from "react"
import { IconPlus } from "@tabler/icons-react"
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@herbcaudill/components"
import { TaskCardCompact } from "./TaskCardCompact"
import { stripTaskPrefix } from "../../lib/stripTaskPrefix"
import type { Task } from "../../types"

/** Relationship types supported by this combobox */
export type TaskRelationType = "blocker" | "blocked" | "child" | "parent"

/**
 * A generalized combobox for selecting tasks to add as related tasks.
 * Supports adding blockers, blocked tasks, children, and setting parent.
 */
export function TaskRelationCombobox({
  task,
  allTasks,
  issuePrefix,
  excludeIds = [],
  relationType,
  onSelect,
  disabled = false,
  buttonText,
  placeholder = "Search tasks...",
}: Props) {
  const [open, setOpen] = useState(false)

  // Get default button text based on relation type
  const resolvedButtonText = buttonText ?? getDefaultButtonText(relationType)

  // Filter available tasks based on relation type and exclusions
  const availableTasks = useMemo(() => {
    return allTasks.filter(t => {
      // Always exclude current task
      if (t.id === task.id) return false

      // Exclude explicitly excluded IDs
      if (excludeIds.includes(t.id)) return false

      // Apply relation-specific filters
      switch (relationType) {
        case "parent":
          // Exclude descendants to prevent circular references
          // Also exclude closed tasks (can't set a closed task as parent)
          return !isDescendantOf(t.id, task.id, allTasks) && t.status !== "closed"

        case "child":
          // Exclude ancestors to prevent circular references
          return !isAncestorOf(t.id, task.id, allTasks)

        case "blocker":
        case "blocked":
          // Only show open tasks - closed tasks can't block or be blocked
          return t.status !== "closed"

        default:
          return true
      }
    })
  }, [allTasks, task.id, excludeIds, relationType])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || availableTasks.length === 0}
          className="text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted h-6 gap-1 px-2 text-xs "
        >
          <IconPlus className="h-3 w-3" />
          {resolvedButtonText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 shadow-md" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 italic">No matches</div>
            </CommandEmpty>
            <CommandGroup className="p-0">
              {availableTasks.map(t => (
                <CommandItem
                  key={t.id}
                  value={`${stripTaskPrefix(t.id, issuePrefix)} ${t.title}`}
                  onSelect={() => {
                    onSelect(t.id)
                    setOpen(false)
                  }}
                  className="border-border gap-0 border-b py-2 last:border-b-0 [&_svg]:size-3.5"
                >
                  <TaskCardCompact task={t} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Get default button text for each relation type */
function getDefaultButtonText(relationType: TaskRelationType): string {
  switch (relationType) {
    case "blocker":
      return "Add blocker"
    case "blocked":
      return "Add blocked task"
    case "child":
      return "Add child"
    case "parent":
      return "Set parent"
  }
}

/** Check if `potentialDescendant` is a descendant of `ancestorId` in the task tree */
function isDescendantOf(potentialDescendant: string, ancestorId: string, allTasks: Task[]): boolean {
  const taskMap = new Map(allTasks.map(t => [t.id, t]))
  const visited = new Set<string>()

  let current = taskMap.get(potentialDescendant)
  while (current?.parent) {
    if (visited.has(current.id)) break // Prevent infinite loops
    visited.add(current.id)

    if (current.parent === ancestorId) return true
    current = taskMap.get(current.parent)
  }

  return false
}

/** Check if `potentialAncestor` is an ancestor of `descendantId` in the task tree */
function isAncestorOf(potentialAncestor: string, descendantId: string, allTasks: Task[]): boolean {
  // Flip the check: is descendantId a descendant of potentialAncestor?
  return isDescendantOf(descendantId, potentialAncestor, allTasks)
}

type Props = {
  /** The current task (to exclude from selections) */
  task: Task
  /** All available tasks to select from */
  allTasks: Task[]
  /** Issue prefix for display (e.g. "rui") */
  issuePrefix: string | null
  /** IDs of tasks to exclude from the list (e.g., already-related tasks) */
  excludeIds?: string[]
  /** Type of relationship being created */
  relationType: TaskRelationType
  /** Callback when a task is selected */
  onSelect: (taskId: string) => void
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Custom button text (overrides default based on relationType) */
  buttonText?: string
  /** Custom placeholder text for search input */
  placeholder?: string
}
