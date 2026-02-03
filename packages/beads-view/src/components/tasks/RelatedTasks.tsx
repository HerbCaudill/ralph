import { useEffect, useState, useCallback } from "react"
import { Label } from "../ui/label"
import { CollapsibleSection } from "./CollapsibleSection"
import { BlockerCombobox } from "./BlockerCombobox"
import type { RelatedTask, Task, TaskCardTask } from "../../types"

/**
 * Displays child tasks and blocking issues for a given task.
 * Shows collapsible sections for children and blockers.
 * When not in read-only mode, allows adding and removing blockers.
 */
export function RelatedTasks({
  taskId,
  task,
  readOnly = false,
  allTasks = [],
  issuePrefix = null,
}: RelatedTasksProps) {
  const [blockers, setBlockers] = useState<RelatedTask[]>([])
  const [dependents, setDependents] = useState<RelatedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingBlocker, setIsAddingBlocker] = useState(false)

  const childTasks: RelatedTask[] = allTasks
    .filter((t: Task) => t.parent === taskId)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
    }))

  const fetchDependencies = useCallback(async () => {
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
      setIsLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      await fetchDependencies()
      if (cancelled) return
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetchDependencies])

  /**
   * Adds a blocker to the current task via API call.
   */
  const handleAddBlocker = useCallback(
    async (blockerId: string) => {
      if (readOnly) return

      setIsAddingBlocker(true)
      try {
        const response = await fetch(`/api/tasks/${taskId}/blockers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockerId }),
        })

        const data = (await response.json()) as { ok: boolean }
        if (data.ok) {
          // Refresh the blockers list
          await fetchDependencies()
        }
      } catch (err) {
        console.error("Failed to add blocker:", err)
      } finally {
        setIsAddingBlocker(false)
      }
    },
    [taskId, readOnly, fetchDependencies],
  )

  /**
   * Removes a blocker from the current task via API call.
   */
  const handleRemoveBlocker = useCallback(
    async (blockerId: string) => {
      if (readOnly) return

      // Optimistically remove from UI
      setBlockers(prev => prev.filter(b => b.id !== blockerId))

      try {
        const response = await fetch(`/api/tasks/${taskId}/blockers/${blockerId}`, {
          method: "DELETE",
        })

        const data = (await response.json()) as { ok: boolean }
        if (!data.ok) {
          // Revert on failure - refetch
          await fetchDependencies()
        }
      } catch (err) {
        console.error("Failed to remove blocker:", err)
        // Revert on error - refetch
        await fetchDependencies()
      }
    },
    [taskId, readOnly, fetchDependencies],
  )

  // Only show blockers with dependency_type === "blocks" (not parent-child)
  const editableBlockers = blockers.filter(b => b.dependency_type === "blocks")

  // Can add blockers if we're not readOnly and we have a task to reference
  const canAddBlockers = !readOnly && task

  // Show section if there's content or if we can add blockers
  const hasContent = childTasks.length > 0 || blockers.length > 0 || dependents.length > 0
  if (!isLoading && !hasContent && !canAddBlockers) {
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
            onRemove={!readOnly ? handleRemoveBlocker : undefined}
            removableIds={editableBlockers.map(b => b.id)}
          />
          {!readOnly && task && (
            <div>
              <BlockerCombobox
                task={task}
                allTasks={allTasks}
                issuePrefix={issuePrefix}
                existingBlockerIds={blockers.map(b => b.id)}
                onAdd={handleAddBlocker}
                disabled={isAddingBlocker}
              />
            </div>
          )}
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
  task?: TaskCardTask
  readOnly?: boolean
  /** All tasks, used to find children and populate the blocker combobox. */
  allTasks?: TaskCardTask[]
  /** Issue prefix for display (e.g. "rui"). */
  issuePrefix?: string | null
}
