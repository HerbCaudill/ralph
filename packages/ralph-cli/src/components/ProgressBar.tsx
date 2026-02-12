import React from "react"
import { Text } from "ink"

/**
 * A simple progress bar component using Unicode block characters.
 * Shows completion progress: completed / total
 */
export const ProgressBar = ({ completed, total, width = 12, repoName }: Props) => {
  if (total === 0) {
    return null
  }

  // Progress is how much is done: completed / total
  const progress = Math.min(1, Math.max(0, completed / total))
  const filledWidth = Math.round(progress * width)
  const emptyWidth = width - filledWidth

  const filled = "▰".repeat(filledWidth)
  const empty = "▱".repeat(emptyWidth)

  return (
    <Text>
      {repoName && (
        <>
          <Text color="cyan">{repoName}</Text>
          <Text dimColor> │ </Text>
        </>
      )}
      <Text color="yellow">{filled}</Text>
      <Text dimColor>{empty}</Text>
      <Text dimColor>
        {" "}
        {completed}/{total}{" "}
      </Text>
    </Text>
  )
}

type Props = {
  /** Number of items completed (closed issues or checked tasks) */
  completed: number
  /** Total number of items seen since startup */
  total: number
  /** Width of the progress bar in characters (default: 12) */
  width?: number
  /** Repository name to display before the progress bar */
  repoName?: string
}
