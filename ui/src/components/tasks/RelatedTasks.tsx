import { useEffect, useState } from "react"
import { useAppStore, selectTasks, selectIssuePrefix, type Task } from "@/store"
import { useTaskDialogContext } from "@/contexts"
import { cn, stripTaskPrefix } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  IconCircle,
  IconCircleDot,
  IconCircleCheck,
  IconBan,
  IconClock,
  IconChevronDown,
  IconChevronUp,
  type TablerIcon,
} from "@tabler/icons-react"
import type { TaskStatus } from "./TaskCard"

// Types

interface RelatedTask {
  id: string
  title: string
  status: TaskStatus
  dependency_type?: string
}

export interface RelatedTasksProps {
  /** The task ID to show related tasks for */
  taskId: string
}

// Status Configuration

interface StatusConfig {
  icon: TablerIcon
  label: string
  color: string
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    color: "text-gray-500",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    color: "text-blue-500",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    color: "text-red-500",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    color: "text-amber-500",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    color: "text-green-500",
  },
}

// TaskLink Component

interface TaskLinkProps {
  task: RelatedTask
  issuePrefix: string | null
}

function TaskLink({ task, issuePrefix }: TaskLinkProps) {
  const taskDialogContext = useTaskDialogContext()
  const config = statusConfig[task.status] || statusConfig.open
  const StatusIcon = config.icon

  const handleClick = () => {
    taskDialogContext?.openTaskById(task.id)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors",
        "hover:bg-muted",
        task.status === "closed" && "opacity-60",
      )}
    >
      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {stripTaskPrefix(task.id, issuePrefix)}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", task.status === "closed" && "line-through")}>
        {task.title}
      </span>
    </button>
  )
}

// Collapsible Section Component

interface CollapsibleSectionProps {
  label: string
  tasks: RelatedTask[]
  issuePrefix: string | null
  defaultExpanded?: boolean
}

function CollapsibleSection({
  label,
  tasks,
  issuePrefix,
  defaultExpanded = true,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (tasks.length === 0) return null

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-medium transition-colors"
      >
        {isExpanded ?
          <IconChevronDown className="h-3.5 w-3.5" />
        : <IconChevronUp className="h-3.5 w-3.5" />}
        {label} ({tasks.length})
      </button>
      {isExpanded && (
        <div className="space-y-0.5">
          {tasks.map(task => (
            <TaskLink key={task.id} task={task} issuePrefix={issuePrefix} />
          ))}
        </div>
      )}
    </div>
  )
}

// RelatedTasks Component

/**
 * Displays child tasks and blocking issues for a given task.
 * Shows collapsible sections for children and blockers.
 */
export function RelatedTasks({ taskId }: RelatedTasksProps) {
  const allTasks = useAppStore(selectTasks)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const [blockers, setBlockers] = useState<RelatedTask[]>([])
  const [dependents, setDependents] = useState<RelatedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Get child tasks from the store
  const childTasks: RelatedTask[] = allTasks
    .filter((t: Task) => t.parent === taskId)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status as TaskStatus,
    }))

  // Fetch dependencies from API
  useEffect(() => {
    let cancelled = false

    async function fetchDependencies() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/tasks/${taskId}`)
        const data = (await response.json()) as {
          ok: boolean
          issue?: {
            dependencies?: Array<{
              id: string
              title: string
              status: string
              dependency_type: string
            }>
            dependents?: Array<{
              id: string
              title: string
              status: string
              dependency_type: string
            }>
          }
        }

        if (cancelled) return

        if (data.ok && data.issue) {
          // Extract blockers (dependencies that block this task)
          const deps = data.issue.dependencies || []
          const blockingDeps = deps
            .filter(d => d.dependency_type === "blocks" || d.dependency_type === "parent-child")
            .map(d => ({
              id: d.id,
              title: d.title,
              status: d.status as TaskStatus,
              dependency_type: d.dependency_type,
            }))
          setBlockers(blockingDeps)

          // Extract dependents (tasks that this task blocks)
          const dependentsData = data.issue.dependents || []
          const dependentsList = dependentsData
            .filter(d => d.dependency_type === "blocks")
            .map(d => ({
              id: d.id,
              title: d.title,
              status: d.status as TaskStatus,
              dependency_type: d.dependency_type,
            }))
          setDependents(dependentsList)
        }
      } catch (err) {
        console.error("Failed to fetch task dependencies:", err)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchDependencies()

    return () => {
      cancelled = true
    }
  }, [taskId])

  // Don't render if there are no related tasks and not loading
  if (!isLoading && childTasks.length === 0 && blockers.length === 0 && dependents.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2">
      <Label>Related</Label>
      {isLoading ?
        <div className="text-muted-foreground text-sm">Loading...</div>
      : <div className="space-y-2">
          <CollapsibleSection
            label="Children"
            tasks={childTasks}
            issuePrefix={issuePrefix}
            defaultExpanded={true}
          />
          <CollapsibleSection
            label="Blocked by"
            tasks={blockers}
            issuePrefix={issuePrefix}
            defaultExpanded={true}
          />
          <CollapsibleSection
            label="Blocks"
            tasks={dependents}
            issuePrefix={issuePrefix}
            defaultExpanded={true}
          />
        </div>
      }
    </div>
  )
}
