import { useState } from "react"
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

/**
 * A combobox for selecting tasks to add as blockers.
 * Filters out the current task and any tasks that are already blockers.
 */
export function BlockerCombobox({
  task,
  allTasks,
  issuePrefix,
  existingBlockerIds,
  onAdd,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)

  // Filter out: current task, tasks that are already blockers
  const availableTasks = allTasks.filter(
    t => t.id !== task.id && !existingBlockerIds.includes(t.id),
  )

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
          Add blocker
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 shadow-md" align="start">
        <Command>
          <CommandInput placeholder="Search tasks..." />
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
                    onAdd(t.id)
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

type Props = {
  task: Task
  allTasks: Task[]
  issuePrefix: string | null
  existingBlockerIds: string[]
  onAdd: (blockerId: string) => void
  disabled?: boolean
}
