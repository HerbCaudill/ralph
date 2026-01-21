import { useEffect, useState } from "react"
import { useAppStore, selectTasks, selectIssuePrefix } from "@/store"
import { Label } from "@/components/ui/label"
import { CollapsibleSection } from "./CollapsibleSection"
import type { RelatedTask, Task } from "@/types"

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

  const childTasks: RelatedTask[] = allTasks
    .filter((t: Task) => t.parent === taskId)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
    }))

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
          const deps = data.issue.dependencies || []
          const blockingDeps = deps
            .filter(d => d.dependency_type === "blocks" || d.dependency_type === "parent-child")
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

export type RelatedTasksProps = {
  taskId: string
}
