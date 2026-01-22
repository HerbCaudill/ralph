/**
 * Creates a regex pattern that matches task IDs with the given prefix.
 * If no prefix is provided, returns null (don't match anything).
 *
 * @param prefix - The issue prefix for this workspace (e.g., "rui")
 * @returns A regex that matches task IDs like "rui-48s" or "rui-4vp.5", or null if no prefix
 */

export function createTaskIdPattern(prefix: string | null): RegExp | null {
  if (!prefix) return null
  // Escape any special regex characters in the prefix (unlikely but safe)
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match prefix-alphanumeric with optional decimal suffixes (e.g., rui-4vp.1 or rui-4vp.1.2.3)
  return new RegExp(`\\b(${escapedPrefix}-[a-z0-9]+(?:\\.\\d+)*)\\b`, "g")
}
