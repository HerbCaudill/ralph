/**
 * Result of parsing a task lifecycle event.
 */
export interface TaskLifecycleInfo {
  action: "starting" | "completed"
  taskId: string
  taskTitle?: string
}

/**
 * Parse a text message to detect task lifecycle events.
 * Returns TaskLifecycleInfo if the text matches the pattern, null otherwise.
 *
 * Patterns recognized:
 * - "✨ Starting **task-id task title**" or "✨ Starting **task-id: task title**"
 * - "✅ Completed **task-id task title**" or "✅ Completed **task-id: task title**"
 */
export function parseTaskLifecycleEvent(text: string): TaskLifecycleInfo | null {
  // Trim whitespace for matching
  const trimmed = text.trim()

  // Match starting pattern: ✨ Starting **task-id task title**
  const startingMatch = trimmed.match(
    /^✨\s*Starting\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)[:\s]+(.+?)\*\*$/i,
  )
  if (startingMatch) {
    return {
      action: "starting",
      taskId: startingMatch[1],
      taskTitle: startingMatch[2].trim(),
    }
  }

  // Also match simpler pattern without title: ✨ Starting **task-id**
  const startingSimpleMatch = trimmed.match(
    /^✨\s*Starting\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)\*\*$/i,
  )
  if (startingSimpleMatch) {
    return {
      action: "starting",
      taskId: startingSimpleMatch[1],
    }
  }

  // Match completed pattern: ✅ Completed **task-id task title**
  const completedMatch = trimmed.match(
    /^✅\s*Completed\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)[:\s]+(.+?)\*\*$/i,
  )
  if (completedMatch) {
    return {
      action: "completed",
      taskId: completedMatch[1],
      taskTitle: completedMatch[2].trim(),
    }
  }

  // Also match simpler pattern without title: ✅ Completed **task-id**
  const completedSimpleMatch = trimmed.match(
    /^✅\s*Completed\s+\*\*([a-z]+-[a-z0-9]+(?:\.[a-z0-9]+)*)\*\*$/i,
  )
  if (completedSimpleMatch) {
    return {
      action: "completed",
      taskId: completedSimpleMatch[1],
    }
  }

  return null
}
