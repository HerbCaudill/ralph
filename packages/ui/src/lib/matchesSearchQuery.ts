import type { TaskCardTask } from "@/types"

export function matchesSearchQuery(task: TaskCardTask, query: string): boolean {
  if (!query.trim()) return true

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const searchableText = [task.id, task.title, task.description ?? ""].join(" ").toLowerCase()

  return words.every(word => searchableText.includes(word))
}
