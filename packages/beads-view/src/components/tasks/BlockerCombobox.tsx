import { useState } from "react"
import { IconCheck, IconPlus } from "@tabler/icons-react"
import { Button } from "../ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command"
import { stripTaskPrefix } from "../../lib/stripTaskPrefix"
import type { TaskCardTask } from "../../types"

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
          className="text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted h-6 gap-1 px-2 text-xs"
        >
          <IconPlus className="h-3 w-3" />
          Add blocker
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tasks..." />
          <CommandList>
            <CommandEmpty>No tasks available.</CommandEmpty>
            <CommandGroup>
              {availableTasks.map(t => (
                <CommandItem
                  key={t.id}
                  value={`${stripTaskPrefix(t.id, issuePrefix)} ${t.title}`}
                  onSelect={() => {
                    onAdd(t.id)
                    setOpen(false)
                  }}
                >
                  <IconCheck className="mr-2 h-4 w-4 opacity-0" />
                  <span className="font-mono text-xs">{stripTaskPrefix(t.id, issuePrefix)}</span>
                  <span className="ml-2 truncate">{t.title}</span>
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
  task: TaskCardTask
  allTasks: TaskCardTask[]
  issuePrefix: string | null
  existingBlockerIds: string[]
  onAdd: (blockerId: string) => void
  disabled?: boolean
}
