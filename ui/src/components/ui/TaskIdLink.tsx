import { useAppStore, selectIssuePrefix } from "@/store"
import { stripTaskPrefix } from "@/lib/utils"
import { buildTaskIdPath } from "@/hooks/useTaskDialogRouter"
import type { ReactNode } from "react"
import { createTaskIdPattern } from "./createTaskIdPattern"

/**
 * Renders text with task IDs converted to clickable links.
 * Task IDs matching the pattern (e.g., rui-48s) become links that navigate
 * to the task details URL.
 */
export function TaskIdLink({ children, className }: TaskIdLinkProps) {
  const issuePrefix = useAppStore(selectIssuePrefix)

  // If no issue prefix is configured, don't try to match any task IDs
  const pattern = createTaskIdPattern(issuePrefix)
  if (!pattern) {
    return <>{children}</>
  }

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

    // Display the task ID without the prefix for cleaner UI
    const displayId = stripTaskPrefix(taskId, issuePrefix)

    parts.push(
      <a
        key={`${taskId}-${startIndex}`}
        href={buildTaskIdPath(taskId)}
        className={
          className ??
          "cursor-pointer text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
        }
        aria-label={`View task ${taskId}`}
      >
        {displayId}
      </a>,
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

// Types

export interface TaskIdLinkProps {
  /** Text content that may contain task IDs */
  children: string
  /** Additional class name for task ID links */
  className?: string
}
