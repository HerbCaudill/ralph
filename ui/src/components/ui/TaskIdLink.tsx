import { useTaskDialogContext } from "@/contexts"
import { useAppStore, selectIssuePrefix } from "@/store"
import { stripTaskPrefix } from "@/lib/utils"
import type { ReactNode, MouseEvent } from "react"

/**
 * Creates a regex pattern that matches task IDs with the given prefix.
 * If no prefix is provided, returns null (don't match anything).
 *
 * @param prefix - The issue prefix for this workspace (e.g., "rui")
 * @returns A regex that matches task IDs like "rui-48s" or "rui-4vp.5", or null if no prefix
 */
function createTaskIdPattern(prefix: string | null): RegExp | null {
  if (!prefix) return null
  // Escape any special regex characters in the prefix (unlikely but safe)
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match prefix-alphanumeric with optional decimal suffix
  return new RegExp(`\\b(${escapedPrefix}-[a-z0-9]+(?:\\.\\d+)?)\\b`, "g")
}

// Types

export interface TaskIdLinkProps {
  /** Text content that may contain task IDs */
  children: string
  /** Additional class name for task ID links */
  className?: string
}

// TaskIdLink Component

/**
 * Renders text with task IDs converted to clickable links.
 * Task IDs matching the pattern (e.g., rui-48s) become links that open
 * the task details dialog when clicked.
 */
export function TaskIdLink({ children, className }: TaskIdLinkProps) {
  const taskDialogContext = useTaskDialogContext()
  const issuePrefix = useAppStore(selectIssuePrefix)

  // If no task dialog context is available, just render the text
  if (!taskDialogContext) {
    return <>{children}</>
  }

  // If no issue prefix is configured, don't try to match any task IDs
  const pattern = createTaskIdPattern(issuePrefix)
  if (!pattern) {
    return <>{children}</>
  }

  const { openTaskById } = taskDialogContext

  // Parse the text and replace task IDs with links
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset the regex state
  pattern.lastIndex = 0

  while ((match = pattern.exec(children)) !== null) {
    const taskId = match[1]
    const startIndex = match.index

    // Add text before the match
    if (startIndex > lastIndex) {
      parts.push(children.slice(lastIndex, startIndex))
    }

    // Add the clickable task ID link
    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      openTaskById(taskId)
    }

    // Display the task ID without the prefix for cleaner UI
    const displayId = stripTaskPrefix(taskId, issuePrefix)

    parts.push(
      <button
        key={`${taskId}-${startIndex}`}
        onClick={handleClick}
        className={
          className ??
          "cursor-pointer text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
        }
        type="button"
        aria-label={`View task ${taskId}`}
      >
        {displayId}
      </button>,
    )

    lastIndex = startIndex + match[0].length
  }

  // Add remaining text after the last match
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex))
  }

  // If no matches were found, return the original text
  if (parts.length === 0) {
    return <>{children}</>
  }

  return <>{parts}</>
}

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
