import { useState } from "react"
import { IconCheck, IconSelector } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn, stripTaskPrefix } from "@/lib/utils"
import type { TaskCardTask } from "@/types"

export function ParentCombobox({ task, allTasks, issuePrefix, value, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const validParents = allTasks.filter(t => t.id !== task.id && t.parent !== task.id)

  const selectedTask = value ? validParents.find(t => t.id === value) : null
  const displayValue =
    value && selectedTask ? `${stripTaskPrefix(value, issuePrefix)} ${selectedTask.title}`
    : value ? stripTaskPrefix(value, issuePrefix)
    : "None"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Parent"
          className="h-8 w-full justify-between px-3 text-sm font-normal"
        >
          <span className="truncate">{displayValue}</span>
          <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tasks..." />
          <CommandList>
            <CommandEmpty>No task found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <IconCheck
                  className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")}
                />
                None
              </CommandItem>
              {validParents.map(t => (
                <CommandItem
                  key={t.id}
                  value={`${stripTaskPrefix(t.id, issuePrefix)} ${t.title}`}
                  onSelect={() => {
                    onChange(t.id)
                    setOpen(false)
                  }}
                >
                  <IconCheck
                    className={cn("mr-2 h-4 w-4", value === t.id ? "opacity-100" : "opacity-0")}
                  />
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
  value: string | null
  onChange: (value: string | null) => void
}
