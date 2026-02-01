/**
 * Build a path-based URL for a task ID.
 */
export function buildTaskIdPath(
  /** Task ID to include in the path. */
  id: string,
): string {
  return `/issue/${id}`
}
