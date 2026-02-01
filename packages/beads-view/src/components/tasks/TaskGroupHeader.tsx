import { useCallback } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { cn } from "../../lib/cn"
import type { ClosedTasksTimeFilter } from "../../types"

export function TaskGroupHeader({
  label,
  count,
  isCollapsed,
  onToggle,
  timeFilter,
  onTimeFilterChange,
}: Props) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onToggle()
      }
    },
    [onToggle],
  )

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation()
      onTimeFilterChange?.(e.target.value as ClosedTasksTimeFilter)
    },
    [onTimeFilterChange],
  )

  const handleFilterClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "bg-muted/50 hover:bg-muted border-border flex cursor-pointer items-center gap-2 border-b px-2 py-1.5",
        "transition-colors",
      )}
      aria-expanded={!isCollapsed}
      aria-label={`${label} section, ${count} task${count === 1 ? "" : "s"}`}
    >
      <IconChevronDown
        className={cn(
          "text-muted-foreground size-3.5 shrink-0 transition-transform",
          isCollapsed && "-rotate-90",
        )}
      />
      <span className="text-xs font-medium">{label}</span>
      {timeFilter && onTimeFilterChange && (
        <select
          value={timeFilter}
          onChange={handleFilterChange}
          onClick={handleFilterClick}
          onKeyDown={e => e.stopPropagation()}
          className={cn(
            "text-muted-foreground bg-muted hover:bg-muted/80 cursor-pointer rounded px-1.5 py-0.5 text-xs",
            "focus:ring-ring border-0 outline-none focus:ring-1",
          )}
          aria-label="Filter closed tasks by time"
        >
          {(Object.keys(closedTimeFilterLabels) as ClosedTasksTimeFilter[]).map(filter => (
            <option key={filter} value={filter}>
              {closedTimeFilterLabels[filter]}
            </option>
          ))}
        </select>
      )}
      <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">{count}</span>
    </div>
  )
}

const closedTimeFilterLabels: Record<ClosedTasksTimeFilter, string> = {
  past_hour: "Past hour",
  past_4_hours: "Past 4 hours",
  past_day: "Past day",
  past_week: "Past week",
  all_time: "All time",
}

type Props = {
  label: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
  timeFilter?: ClosedTasksTimeFilter
  onTimeFilterChange?: (filter: ClosedTasksTimeFilter) => void
}
