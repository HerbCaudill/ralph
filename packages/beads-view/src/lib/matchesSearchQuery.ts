import type { Task } from "../types"

/** Check whether a task matches a free-text search query. */
export function matchesSearchQuery(
  /** Task to search. */
  task: Task,
  /** Query string to match. */
  query: string,
): boolean {
  if (!query.trim()) return true

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const searchableText = [task.id, task.title, task.description ?? ""].join(" ").toLowerCase()

  return words.every(word => searchableText.includes(word))
}
