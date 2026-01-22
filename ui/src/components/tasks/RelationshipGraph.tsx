import { useEffect, useState, useMemo } from "react"
import { useAppStore, selectTasks, selectIssuePrefix } from "@/store"
import { useTaskDialogContext } from "@/contexts"
import { Label } from "@/components/ui/label"
import { RelationshipGraphEdge } from "./RelationshipGraphEdge"
import { RelationshipGraphNode } from "./RelationshipGraphNode"
import type { RelatedTask, Task, TaskStatus } from "@/types"

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

  /**
   * Extracts the current task from the tasks list.
   */
  const currentTask = useMemo(() => {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return null
    return {
      id: task.id,
      title: task.title,
      status: task.status,
    }
  }, [allTasks, taskId])

  /**
   * Extracts all child tasks of the current task.
   */
  const childTasks: RelatedTask[] = useMemo(
    () =>
      allTasks
        .filter((t: Task) => t.parent === taskId)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
    [allTasks, taskId],
  )

  /**
   * Fetches task blockers and dependents from the API.
   */
  useEffect(() => {
    let cancelled = false

    /**
     * Fetches blocking and dependent tasks for the current task.
     */
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
          const deps = data.issue.dependencies || []
          const blockingDeps = deps
            .filter(d => d.dependency_type === "blocks")
            .map(d => ({
              id: d.id,
              title: d.title,
              status: d.status as RelatedTask["status"],
              dependency_type: d.dependency_type,
            }))
          setBlockers(blockingDeps)

          const dependentsData = data.issue.dependents || []
          const dependentsList = dependentsData
            .filter(d => d.dependency_type === "blocks")
            .map(d => ({
              id: d.id,
              title: d.title,
              status: d.status as RelatedTask["status"],
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

  /**
   * Opens the task details dialog for a related task.
   */
  const handleTaskClick = (id: string) => {
    taskDialogContext?.openTaskById(id)
  }

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

  const nodeHeight = 32
  const nodeSpacing = 12
  const verticalGap = 40
  const horizontalGap = 60

  const centerX = 200
  const centerY = hasParent ? 80 : 40

  return (
    <div className="grid gap-2">
      <Label>Relationships</Label>
      <div className="relative overflow-x-auto">
        <div className="min-w-fit">
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

            {hasParent && (
              <RelationshipGraphEdge
                from={{ x: centerX, y: centerY - verticalGap + nodeHeight / 2 }}
                to={{ x: centerX, y: centerY - 8 }}
                type="parent-child"
                direction="down"
              />
            )}

            {childTasks.map((_, index) => (
              <RelationshipGraphEdge
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

            {blockers.map((_, index) => (
              <RelationshipGraphEdge
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

            {dependents.map((_, index) => (
              <RelationshipGraphEdge
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

          <div className="relative flex flex-col items-center gap-2 py-2">
            {hasParent && parent && (
              <div className="mb-4 flex justify-center">
                <div className="flex flex-col items-center">
                  <span className="text-muted-foreground mb-1 text-[10px]">Parent</span>
                  <RelationshipGraphNode
                    task={parent}
                    issuePrefix={issuePrefix}
                    onClick={() => handleTaskClick(parent.id)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              {hasBlockers && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-muted-foreground text-[10px]">Blocked by</span>
                  {blockers.map(task => (
                    <RelationshipGraphNode
                      key={task.id}
                      task={task}
                      issuePrefix={issuePrefix}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              )}

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

              <div className="flex flex-col items-center">
                <span className="text-muted-foreground mb-1 text-[10px]">Current</span>
                <RelationshipGraphNode
                  task={currentTask}
                  issuePrefix={issuePrefix}
                  onClick={() => handleTaskClick(currentTask.id)}
                  isCurrent
                  size="md"
                />
              </div>

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

              {hasDependents && (
                <div className="flex flex-col items-start gap-1">
                  <span className="text-muted-foreground text-[10px]">Blocks</span>
                  {dependents.map(task => (
                    <RelationshipGraphNode
                      key={task.id}
                      task={task}
                      issuePrefix={issuePrefix}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {hasChildren && (
              <div className="mt-4 flex flex-col items-center">
                <span className="text-muted-foreground mb-1 text-[10px]">Children</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {childTasks.map(task => (
                    <RelationshipGraphNode
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

export type RelationshipGraphProps = {
  taskId: string
  parent?: { id: string; title: string; status: TaskStatus } | null
}
