/** Strip the issue prefix from a task ID for display. */
export function stripTaskPrefix(
  /** Full task ID (for example, "rui-4vp" or "rui-4vp.5"). */
  taskId: string,
  /** Issue prefix for the current workspace. */
  prefix: string | null,
): string {
  if (!prefix) return taskId

  const expectedPrefix = `${prefix}-`
  if (taskId.startsWith(expectedPrefix)) {
    return taskId.slice(expectedPrefix.length)
  }

  return taskId
}
