/**
 * Strip the issue prefix from a task ID for display.
 *
 * Given a task ID like "rui-4vp" and a prefix like "rui",
 * returns just "4vp". This provides a cleaner display in the UI
 * since the prefix is redundant within a single workspace.
 *
 * @param taskId - The full task ID (e.g., "rui-4vp" or "rui-4vp.5")
 * @param prefix - The issue prefix for this workspace (e.g., "rui")
 * @returns The task ID without the prefix (e.g., "4vp" or "4vp.5"), or the full ID if no match
 */
export function stripTaskPrefix(taskId: string, prefix: string | null): string {
  if (!prefix) return taskId

  const expectedPrefix = `${prefix}-`
  if (taskId.startsWith(expectedPrefix)) {
    return taskId.slice(expectedPrefix.length)
  }

  return taskId
}
