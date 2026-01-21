import { useEffect, useState, useMemo } from "react"
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

export interface RelationshipGraphProps {
  /** The task ID to show relationships for */
  taskId: string
  /** Parent task info (if any) */
  parent?: { id: string; title: string; status: TaskStatus } | null
}

// Status Configuration

interface StatusConfig {
  icon: TablerIcon
  label: string
  bgColor: string
  borderColor: string
  textColor: string
}

const statusConfig: Record<TaskStatus, StatusConfig> = {
  open: {
    icon: IconCircle,
    label: "Open",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-gray-400",
    textColor: "text-gray-600 dark:text-gray-400",
  },
  in_progress: {
    icon: IconCircleDot,
    label: "In Progress",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  blocked: {
    icon: IconBan,
    label: "Blocked",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-500",
    textColor: "text-red-600 dark:text-red-400",
  },
  deferred: {
    icon: IconClock,
    label: "Deferred",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  closed: {
    icon: IconCircleCheck,
    label: "Closed",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-500",
    textColor: "text-green-600 dark:text-green-400",
  },
}

// Node Component

interface NodeProps {
  task: RelatedTask
  issuePrefix: string | null
  onClick: () => void
  isCurrent?: boolean
  size?: "sm" | "md"
}

function Node({ task, issuePrefix, onClick, isCurrent = false, size = "sm" }: NodeProps) {
  const config = statusConfig[task.status] || statusConfig.open
  const StatusIcon = config.icon

  return (
    <button
      type="button"
      onClick={onClick}
      title={task.title}
      className={cn(
        "flex items-center gap-1.5 rounded-md border-2 transition-all",
        "hover:scale-105 hover:shadow-md",
        config.bgColor,
        config.borderColor,
        isCurrent ? "ring-primary ring-2 ring-offset-2" : "",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        task.status === "closed" && "opacity-60",
      )}
    >
      <StatusIcon
        className={cn("shrink-0", config.textColor, size === "sm" ? "h-3 w-3" : "h-4 w-4")}
      />
      <span className={cn("shrink-0 font-mono", config.textColor)}>
        {stripTaskPrefix(task.id, issuePrefix)}
      </span>
      <span className={cn("max-w-[120px] truncate", task.status === "closed" && "line-through")}>
        {task.title}
      </span>
    </button>
  )
}

// Edge Component (SVG line)

interface EdgeProps {
  from: { x: number; y: number }
  to: { x: number; y: number }
  type: "parent-child" | "blocks"
  direction?: "up" | "down" | "left" | "right"
}

function Edge({ from, to, type }: EdgeProps) {
  // Create a simple straight or curved path
  const isVertical = Math.abs(from.x - to.x) < Math.abs(from.y - to.y)

  let path: string
  if (isVertical) {
    // Vertical connection - use straight line
    path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  } else {
    // Horizontal connection - use curved line
    const controlOffset = Math.abs(to.x - from.x) * 0.3
    path = `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`
  }

  return (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeDasharray={type === "blocks" ? "4 2" : "none"}
      className={cn(
        type === "parent-child" ? "text-muted-foreground" : "text-amber-500 dark:text-amber-400",
      )}
      markerEnd="url(#arrowhead)"
    />
  )
}

// RelationshipGraph Component

/**
 * Displays a graphical representation of task relationships.
 * Shows parent above, children below, blockers on left, dependents on right.
 */
export function RelationshipGraph({ taskId, parent }: RelationshipGraphProps) {
  const allTasks = useAppStore(selectTasks)
  const issuePrefix = useAppStore(selectIssuePrefix)
  const taskDialogContext = useTaskDialogContext()
  const [blockers, setBlockers] = useState<RelatedTask[]>([])
  const [dependents, setDependents] = useState<RelatedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Get current task
  const currentTask = useMemo(() => {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return null
    return {
      id: task.id,
      title: task.title,
      status: task.status as TaskStatus,
    }
  }, [allTasks, taskId])

  // Get child tasks from the store
  const childTasks: RelatedTask[] = useMemo(
    () =>
      allTasks
        .filter((t: Task) => t.parent === taskId)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status as TaskStatus,
        })),
    [allTasks, taskId],
  )

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
            .filter(d => d.dependency_type === "blocks")
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

  const handleTaskClick = (id: string) => {
    taskDialogContext?.openTaskById(id)
  }

  // Don't render if there are no relationships and not loading
  const hasParent = parent != null
  const hasChildren = childTasks.length > 0
  const hasBlockers = blockers.length > 0
  const hasDependents = dependents.length > 0
  const hasAnyRelationships = hasParent || hasChildren || hasBlockers || hasDependents

  if (!isLoading && !hasAnyRelationships) {
    return null
  }

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Label>Relationships</Label>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!currentTask) {
    return null
  }

  // Calculate layout dimensions
  const nodeHeight = 32
  const nodeSpacing = 12
  const verticalGap = 40
  const horizontalGap = 60

  // Calculate positions for different sections
  const centerX = 200
  const centerY = hasParent ? 80 : 40

  return (
    <div className="grid gap-2">
      <Label>Relationships</Label>
      <div className="relative overflow-x-auto">
        <div className="min-w-fit">
          {/* SVG for edges */}
          <svg
            className="pointer-events-none absolute inset-0"
            style={{ width: "100%", height: "100%", overflow: "visible" }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 6 3, 0 6"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
              </marker>
            </defs>

            {/* Parent edge */}
            {hasParent && (
              <Edge
                from={{ x: centerX, y: centerY - verticalGap + nodeHeight / 2 }}
                to={{ x: centerX, y: centerY - 8 }}
                type="parent-child"
                direction="down"
              />
            )}

            {/* Children edges */}
            {childTasks.map((_, index) => (
              <Edge
                key={`child-edge-${index}`}
                from={{ x: centerX, y: centerY + nodeHeight + 8 }}
                to={{
                  x: centerX,
                  y: centerY + nodeHeight + verticalGap + index * (nodeHeight + nodeSpacing),
                }}
                type="parent-child"
                direction="down"
              />
            ))}

            {/* Blocker edges (from left) */}
            {blockers.map((_, index) => (
              <Edge
                key={`blocker-edge-${index}`}
                from={{
                  x: centerX - horizontalGap - 100,
                  y: centerY + nodeHeight / 2 + index * (nodeHeight + nodeSpacing),
                }}
                to={{ x: centerX - 80, y: centerY + nodeHeight / 2 }}
                type="blocks"
                direction="right"
              />
            ))}

            {/* Dependent edges (to right) */}
            {dependents.map((_, index) => (
              <Edge
                key={`dependent-edge-${index}`}
                from={{ x: centerX + 200, y: centerY + nodeHeight / 2 }}
                to={{
                  x: centerX + horizontalGap + 200,
                  y: centerY + nodeHeight / 2 + index * (nodeHeight + nodeSpacing),
                }}
                type="blocks"
                direction="right"
              />
            ))}
          </svg>

          {/* Nodes */}
          <div className="relative flex flex-col items-center gap-2 py-2">
            {/* Parent row */}
            {hasParent && parent && (
              <div className="mb-4 flex justify-center">
                <div className="flex flex-col items-center">
                  <span className="text-muted-foreground mb-1 text-[10px]">Parent</span>
                  <Node
                    task={parent}
                    issuePrefix={issuePrefix}
                    onClick={() => handleTaskClick(parent.id)}
                  />
                </div>
              </div>
            )}

            {/* Middle row: Blockers | Current | Dependents */}
            <div className="flex items-center gap-4">
              {/* Blockers section */}
              {hasBlockers && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-muted-foreground text-[10px]">Blocked by</span>
                  {blockers.map(task => (
                    <Node
                      key={task.id}
                      task={task}
                      issuePrefix={issuePrefix}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              )}

              {/* Arrow from blockers */}
              {hasBlockers && (
                <div className="text-amber-500 dark:text-amber-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M14 7l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4 2"
                    />
                  </svg>
                </div>
              )}

              {/* Current task (center) */}
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground mb-1 text-[10px]">Current</span>
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-sm",
                    "ring-primary ring-2 ring-offset-2",
                    statusConfig[currentTask.status].bgColor,
                    statusConfig[currentTask.status].borderColor,
                  )}
                >
                  {(() => {
                    const config = statusConfig[currentTask.status]
                    const StatusIcon = config.icon
                    return (
                      <>
                        <StatusIcon className={cn("h-4 w-4 shrink-0", config.textColor)} />
                        <span className={cn("shrink-0 font-mono", config.textColor)}>
                          {stripTaskPrefix(currentTask.id, issuePrefix)}
                        </span>
                        <span className="max-w-[150px] truncate font-medium">
                          {currentTask.title}
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Arrow to dependents */}
              {hasDependents && (
                <div className="text-amber-500 dark:text-amber-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M14 7l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4 2"
                    />
                  </svg>
                </div>
              )}

              {/* Dependents section */}
              {hasDependents && (
                <div className="flex flex-col items-start gap-1">
                  <span className="text-muted-foreground text-[10px]">Blocks</span>
                  {dependents.map(task => (
                    <Node
                      key={task.id}
                      task={task}
                      issuePrefix={issuePrefix}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Children row */}
            {hasChildren && (
              <div className="mt-4 flex flex-col items-center">
                <span className="text-muted-foreground mb-1 text-[10px]">Children</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {childTasks.map(task => (
                    <Node
                      key={task.id}
                      task={task}
                      issuePrefix={issuePrefix}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="text-muted-foreground mt-2 flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="bg-muted-foreground h-0.5 w-4" />
          <span>Parent/Child</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
          <span>Blocks</span>
        </div>
      </div>
    </div>
  )
}
