/**
 * Build a legacy hash URL for a task ID.
 */
export function buildTaskIdHash(
  /** Task ID to include in the hash. */
  id: string,
): string {
  return `#id=${id}`
}
