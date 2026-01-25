import { useState, useMemo, useCallback } from "react"
import { IconChevronDown, IconHistory, IconClock, IconFile } from "@tabler/icons-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { formatEventLogTime } from "@/lib/formatEventLogDate"
import type { IterationSummary } from "@/hooks"
import type { IterationTaskInfo } from "@/store"

/**
 * Dropdown for selecting iterations - both current session iterations and past iterations.
 * Shows current task/iteration info as the trigger, with a searchable list of past iterations.
 */
export function IterationHistoryDropdown({
  currentTask,
  iterationCount,
  displayedIteration,
  isViewingLatest,
  viewingIterationIndex,
  iterationTaskInfos,
  iterations,
  isLoadingIterations,
  issuePrefix,
  onIterationSelect,
  onIterationHistorySelect,
  onLatest,
}: IterationHistoryDropdownProps) {
  const [open, setOpen] = useState(false)

  // Group iterations by date (Today, Yesterday, or specific date)
  const groupedIterations = useMemo(() => {
    if (!iterations.length) return []

    const groups = new Map<string, IterationSummary[]>()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    for (const log of iterations) {
      const logDate = new Date(log.createdAt)
      const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate())

      let dateLabel: string
      if (logDay.getTime() === today.getTime()) {
        dateLabel = "Today"
      } else if (logDay.getTime() === yesterday.getTime()) {
        dateLabel = "Yesterday"
      } else {
        dateLabel = logDay.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      }

      const existing = groups.get(dateLabel)
      if (existing) {
        existing.push(log)
      } else {
        groups.set(dateLabel, [log])
      }
    }

    return Array.from(groups.entries()).map(([dateLabel, logs]) => ({ dateLabel, logs }))
  }, [iterations])

  const handleIterationSelect = useCallback(
    (index: number) => {
      onIterationSelect(index)
      setOpen(false)
    },
    [onIterationSelect],
  )

  const handleIterationHistorySelect = useCallback(
    (id: string) => {
      onIterationHistorySelect(id)
      setOpen(false)
    },
    [onIterationHistorySelect],
  )

  const handleLatest = useCallback(() => {
    onLatest()
    setOpen(false)
  }, [onLatest])

  // Build the trigger label
  const triggerLabel = useMemo(() => {
    if (currentTask) {
      return {
        id: currentTask.id,
        title: currentTask.title,
      }
    }
    if (iterationCount > 0) {
      return {
        id: null,
        title: `Iteration ${displayedIteration} of ${iterationCount}`,
      }
    }
    return {
      id: null,
      title: "No active task",
    }
  }, [currentTask, iterationCount, displayedIteration])

  // Build current session iteration items (only show if more than 1)
  const currentSessionItems = useMemo(() => {
    if (iterationCount <= 1) return []
    return Array.from({ length: iterationCount }, (_, i) => {
      const taskInfo = iterationTaskInfos[i]
      return {
        index: i,
        label: `Iteration ${i + 1}`,
        taskId: taskInfo?.id ?? null,
        taskTitle: taskInfo?.title ?? null,
        isLatest: i === iterationCount - 1,
        isSelected: isViewingLatest ? i === iterationCount - 1 : viewingIterationIndex === i,
      }
    })
  }, [iterationCount, isViewingLatest, viewingIterationIndex, iterationTaskInfos])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1.5 text-xs transition-colors",
            "focus:ring-ring rounded focus:ring-1 focus:outline-none",
          )}
          title="View iteration history"
          aria-label="View iteration history"
          data-testid="iteration-history-dropdown-trigger"
        >
          {triggerLabel.id && (
            <span className="shrink-0 font-mono opacity-70">
              {stripTaskPrefix(triggerLabel.id, issuePrefix)}
            </span>
          )}
          <span className="truncate">{triggerLabel.title}</span>
          <IconChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="center">
        <Command>
          <CommandInput placeholder="Search iterations..." />
          <CommandList>
            <CommandEmpty>No iterations found.</CommandEmpty>

            {/* Current session iterations */}
            {currentSessionItems.length > 0 && (
              <CommandGroup heading="Current Session">
                {currentSessionItems.map(item => (
                  <CommandItem
                    key={`iteration-${item.index}`}
                    value={`${item.label} ${item.taskId || ""} ${item.taskTitle || ""}`}
                    onSelect={() =>
                      item.isLatest ? handleLatest() : handleIterationSelect(item.index)
                    }
                    className={cn(item.isSelected && "bg-repo-accent", "flex items-center gap-2")}
                  >
                    <IconHistory className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground shrink-0 text-xs">{item.label}</span>
                        {item.taskId && (
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {stripTaskPrefix(item.taskId, issuePrefix)}
                          </span>
                        )}
                      </div>
                      {item.taskTitle && <div className="truncate text-sm">{item.taskTitle}</div>}
                    </div>
                    {item.isLatest && (
                      <span className="bg-repo-accent text-repo-accent-foreground shrink-0 rounded px-1.5 py-0.5 text-xs">
                        Latest
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Separator if we have both current and past iterations */}
            {currentSessionItems.length > 0 && groupedIterations.length > 0 && <CommandSeparator />}

            {/* Past iterations grouped by date */}
            {isLoadingIterations ?
              <div className="text-muted-foreground flex items-center justify-center py-4 text-sm">
                Loading history...
              </div>
            : groupedIterations.length > 0 ?
              groupedIterations.map(({ dateLabel, logs }) => (
                <CommandGroup key={dateLabel} heading={dateLabel}>
                  {logs.map(log => (
                    <CommandItem
                      key={log.id}
                      value={`${log.metadata?.taskId || ""} ${log.metadata?.title || ""} ${log.id}`}
                      onSelect={() => handleIterationHistorySelect(log.id)}
                      className="flex items-center gap-2"
                    >
                      <IconHistory className="text-muted-foreground size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {log.metadata?.taskId && (
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {stripTaskPrefix(log.metadata.taskId, issuePrefix)}
                            </span>
                          )}
                          <span className="truncate text-sm">
                            {log.metadata?.title || (log.metadata?.taskId ? "" : "No task")}
                          </span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5">
                            <IconClock className="size-3" />
                            {formatEventLogTime(log.createdAt)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <IconFile className="size-3" />
                            {log.eventCount}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            : !isLoadingIterations && currentSessionItems.length === 0 ?
              <div className="text-muted-foreground py-4 text-center text-sm">
                No iteration history yet.
              </div>
            : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export interface IterationHistoryDropdownProps {
  /** Current task info (from iteration events) */
  currentTask: { id: string | null; title: string } | null
  /** Number of iterations in current session */
  iterationCount: number
  /** Currently displayed iteration number (1-indexed) */
  displayedIteration: number
  /** Whether viewing the latest iteration */
  isViewingLatest: boolean
  /** Currently viewing iteration index (null if viewing latest) */
  viewingIterationIndex: number | null
  /** Task info for all iterations (indexed by iteration) */
  iterationTaskInfos: IterationTaskInfo[]
  /** List of past iteration summaries */
  iterations: IterationSummary[]
  /** Whether iterations are loading */
  isLoadingIterations: boolean
  /** Issue prefix for stripping from task IDs */
  issuePrefix: string | null
  /** Callback when selecting a current session iteration */
  onIterationSelect: (index: number) => void
  /** Callback when selecting a past iteration from history */
  onIterationHistorySelect: (id: string) => void
  /** Callback to go to latest iteration */
  onLatest: () => void
}
