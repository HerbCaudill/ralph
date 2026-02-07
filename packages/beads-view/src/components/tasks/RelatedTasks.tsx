import { useEffect, useState, useCallback, useMemo } from "react"
import { Label } from "@herbcaudill/components"
import { IconX } from "@tabler/icons-react"
import { GroupedTaskList } from "./GroupedTaskList"
import { BlockerCombobox } from "./BlockerCombobox"
import { apiFetch } from "../../lib/apiClient"
import type { RelatedTask, Task, TaskCardTask, TaskTreeNode } from "../../types"

/**
 * Displays child tasks and blocking issues for a given task.
 * Shows grouped sections for children, blockers, and dependents.
 * When not in read-only mode, allows adding and removing blockers.
 */
export function RelatedTasks({
  taskId,
  task,
  readOnly = false,
  allTasks = [],
  issuePrefix = null,
  onTaskClick,
}: RelatedTasksProps) {
  const [blockers, setBlockers] = useState<RelatedTask[]>([])
  const [dependents, setDependents] = useState<RelatedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingBlocker, setIsAddingBlocker] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

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
      const response = await apiFetch(`/api/tasks/${taskId}`)
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

  /** Adds a blocker to the current task via API call. */
  const handleAddBlocker = useCallback(
    async (blockerId: string) => {
      if (readOnly) return

      setIsAddingBlocker(true)
      try {
        const response = await apiFetch(`/api/tasks/${taskId}/blockers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockerId }),
        })

        const data = (await response.json()) as { ok: boolean }
        if (data.ok) {
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

  /** Removes a blocker from the current task via API call. */
  const handleRemoveBlocker = useCallback(
    async (blockerId: string) => {
      if (readOnly) return

      // Optimistically remove from UI
      setBlockers(prev => prev.filter(b => b.id !== blockerId))

      try {
        const response = await apiFetch(`/api/tasks/${taskId}/blockers/${blockerId}`, {
          method: "DELETE",
        })

        const data = (await response.json()) as { ok: boolean }
        if (!data.ok) {
          await fetchDependencies()
        }
      } catch (err) {
        console.error("Failed to remove blocker:", err)
        await fetchDependencies()
      }
    },
    [taskId, readOnly, fetchDependencies],
  )

  const handleToggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Only show blockers with dependency_type === "blocks" (not parent-child)
  const editableBlockerIds = useMemo(
    () => new Set(blockers.filter(b => b.dependency_type === "blocks").map(b => b.id)),
    [blockers],
  )

  const canAddBlockers = !readOnly && task

  const groups = useMemo(() => {
    const result: Array<{
      key: string
      label: string
      trees: TaskTreeNode[]
      count: number
      isCollapsed: boolean
      onToggle: () => void
    }> = []

    if (childTasks.length > 0) {
      result.push({
        key: "children",
        label: "Children",
        trees: childTasks.map(toTreeNode),
        count: childTasks.length,
        isCollapsed: collapsedGroups["children"] ?? false,
        onToggle: () => handleToggleGroup("children"),
      })
    }

    if (blockers.length > 0) {
      result.push({
        key: "blocked-by",
        label: "Blocked by",
        trees: blockers.map(toTreeNode),
        count: blockers.length,
        isCollapsed: collapsedGroups["blocked-by"] ?? false,
        onToggle: () => handleToggleGroup("blocked-by"),
      })
    }

    if (dependents.length > 0) {
      result.push({
        key: "blocks",
        label: "Blocks",
        trees: dependents.map(toTreeNode),
        count: dependents.length,
        isCollapsed: collapsedGroups["blocks"] ?? false,
        onToggle: () => handleToggleGroup("blocks"),
      })
    }

    return result
  }, [childTasks, blockers, dependents, collapsedGroups, handleToggleGroup])

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
          {groups.length > 0 && (
            <GroupedTaskList groups={groups} onTaskClick={onTaskClick} className="h-auto" />
          )}
          {!readOnly && !collapsedGroups["blocked-by"] && blockers.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2">
              {blockers
                .filter(b => editableBlockerIds.has(b.id))
                .map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleRemoveBlocker(b.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
                    aria-label={`Remove ${b.id} as blocker`}
                  >
                    <IconX className="size-3" />
                    <span>{b.id}</span>
                  </button>
                ))}
            </div>
          )}
          {canAddBlockers && (
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
        </div>
      }
    </div>
  )
}

/** Converts a RelatedTask to a TaskTreeNode with a minimal TaskCardTask. */
function toTreeNode(related: RelatedTask): TaskTreeNode {
  return {
    task: {
      id: related.id,
      title: related.title,
      status: related.status,
    },
    children: [],
  }
}

export type RelatedTasksProps = {
  taskId: string
  task?: TaskCardTask
  readOnly?: boolean
  /** All tasks, used to find children and populate the blocker combobox. */
  allTasks?: TaskCardTask[]
  /** Issue prefix for display (e.g. "rui"). */
  issuePrefix?: string | null
  /** Callback when a related task is clicked. */
  onTaskClick?: (id: string) => void
}
