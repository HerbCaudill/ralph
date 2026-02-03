/**
 * Remove the prefix from a task ID for display purposes.
 * Given "rui-123" returns "123", given "r-abc12" returns "abc12".
 */
export function cutTaskIdPrefix(
  /** The full task ID including prefix (e.g., "rui-123") */
  taskId: string,
): string {
  const dashIndex = taskId.indexOf("-")
  if (dashIndex === -1) {
    return taskId
  }
  return taskId.slice(dashIndex + 1)
}
