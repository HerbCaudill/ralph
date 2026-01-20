/**
 * Result of parsing a task lifecycle event.
 */
export interface TaskLifecycleInfo {
  action: "starting" | "completed"
  taskId?: string
  taskTitle?: string
}

/**
 * Parse a text message to detect task lifecycle events.
 * Returns TaskLifecycleInfo if the text matches the pattern, null otherwise.
 *
 * Patterns recognized:
 * - "✨ Starting **task-id task title**" or "✨ Starting **task-id: task title**"
 * - "✨ Starting -> task title" (without task ID)
 * - "✅ Completed **task-id task title**" or "✅ Completed **task-id: task title**"
 * - "✅ Completed -> task title" (without task ID)
 */
export function parseTaskLifecycleEvent(text: string): TaskLifecycleInfo | null {
  // Search for pattern within text (support multi-line by checking first line)
  const lines = text.split('\n')
  const firstLine = lines[0].trim()

  // Match starting pattern with task ID and bold: ✨ Starting **task-id task title**
  const startingMatchBold = firstLine.match(
    /^✨\s*Starting\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)[:\s]+(.+?)\*\*$/i,
  )
  if (startingMatchBold) {
    return {
      action: "starting",
      taskId: startingMatchBold[1],
      taskTitle: startingMatchBold[2].trim(),
    }
  }

  // Match simpler pattern without title: ✨ Starting **task-id**
  const startingSimpleMatchBold = firstLine.match(
    /^✨\s*Starting\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)\*\*$/i,
  )
  if (startingSimpleMatchBold) {
    return {
      action: "starting",
      taskId: startingSimpleMatchBold[1],
    }
  }

  // Match arrow pattern without task ID: ✨ Starting -> task title
  const startingMatchArrow = firstLine.match(
    /^✨\s*Starting\s+->\s+(.+)$/i,
  )
  if (startingMatchArrow) {
    return {
      action: "starting",
      taskTitle: startingMatchArrow[1].trim(),
    }
  }

  // Match completed pattern with task ID and bold: ✅ Completed **task-id task title**
  const completedMatchBold = firstLine.match(
    /^✅\s*Completed\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)[:\s]+(.+?)\*\*$/i,
  )
  if (completedMatchBold) {
    return {
      action: "completed",
      taskId: completedMatchBold[1],
      taskTitle: completedMatchBold[2].trim(),
    }
  }

  // Match simpler pattern without title: ✅ Completed **task-id**
  const completedSimpleMatchBold = firstLine.match(
    /^✅\s*Completed\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)\*\*$/i,
  )
  if (completedSimpleMatchBold) {
    return {
      action: "completed",
      taskId: completedSimpleMatchBold[1],
    }
  }

  // Match arrow pattern without task ID: ✅ Completed -> task title
  const completedMatchArrow = firstLine.match(
    /^✅\s*Completed\s+->\s+(.+)$/i,
  )
  if (completedMatchArrow) {
    return {
      action: "completed",
      taskTitle: completedMatchArrow[1].trim(),
    }
  }

  return null
}
