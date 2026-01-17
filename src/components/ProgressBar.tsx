import React from "react"
import { Text } from "ink"

/**
 * A simple progress bar component using Unicode block characters.
 * Shows completion progress: (total - remaining) / total
 */
export const ProgressBar = ({ remaining, total, width = 20 }: Props) => {
  if (total === 0) {
    return null
  }

  // Progress is how much is done: 1 - (remaining / total)
  const progress = Math.min(1, Math.max(0, 1 - remaining / total))
  const filledWidth = Math.round(progress * width)
  const emptyWidth = width - filledWidth

  const filled = "█".repeat(filledWidth)
  const empty = "░".repeat(emptyWidth)

  const percent = Math.round(progress * 100)

  return (
    <Text>
      <Text color="yellow">{filled}</Text>
      <Text dimColor>{empty}</Text>
      <Text dimColor> {percent}%</Text>
    </Text>
  )
}

type Props = {
  /** Number of items remaining (open issues or unchecked tasks) */
  remaining: number
  /** Total number of items at the start */
  total: number
  /** Width of the progress bar in characters (default: 20) */
  width?: number
}
