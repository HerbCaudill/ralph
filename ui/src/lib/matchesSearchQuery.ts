import type { TaskCardTask } from "@/types"

export function matchesSearchQuery(task: TaskCardTask, query: string): boolean {
  if (!query.trim()) return true
  const lowerQuery = query.toLowerCase()
  return (
    task.id.toLowerCase().includes(lowerQuery) ||
    task.title.toLowerCase().includes(lowerQuery) ||
    (task.description?.toLowerCase().includes(lowerQuery) ?? false)
  )
}
