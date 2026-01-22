import { createTaskIdPattern } from "../components/ui/TaskIdLink"

/**
 * Utility function to check if a string contains any task IDs with the given prefix.
 *
 * @param text - The text to check
 * @param prefix - The issue prefix (e.g., "rui")
 * @returns true if the text contains task IDs matching the prefix
 */

export function containsTaskId(text: string, prefix: string | null): boolean {
  const pattern = createTaskIdPattern(prefix)
  if (!pattern) return false
  return pattern.test(text)
}
