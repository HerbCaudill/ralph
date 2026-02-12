import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * Information about a session's task lifecycle state.
 */
interface SessionTaskInfo {
  sessionId: string
  hasStartTask: boolean
  hasEndTask: boolean
  /** Timestamp from the session_created event. */
  createdAt: number
}

/**
 * Parse a session's JSONL file to check for task lifecycle markers.
 * Returns null if the file doesn't exist or doesn't contain the target task.
 */
function parseSessionForTask(
  filePath: string,
  taskId: string,
): SessionTaskInfo | null {
  if (!existsSync(filePath)) return null

  try {
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n").filter(line => line.trim())

    let sessionId: string | null = null
    let createdAt = 0
    let hasStartTask = false
    let hasEndTask = false

    // Build regex patterns for the specific task ID (case insensitive)
    const startPattern = new RegExp(`<start_task>${escapeRegex(taskId)}</start_task>`, "i")
    const endPattern = new RegExp(`<end_task>${escapeRegex(taskId)}</end_task>`, "i")

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as Record<string, unknown>

        // Extract session info from creation event
        if (event.type === "session_created") {
          sessionId = (event.sessionId as string) || null
          createdAt = (event.timestamp as number) || 0
        }

        // Check assistant messages for task markers
        const text = (event.text as string) || ""
        if (startPattern.test(text)) {
          hasStartTask = true
        }
        if (endPattern.test(text)) {
          hasEndTask = true
        }
      } catch {
        // Skip malformed JSON lines
        continue
      }
    }

    // Only return info if we found a start_task marker for this task
    if (!hasStartTask) return null

    // Extract sessionId from filename if not found in events
    if (!sessionId) {
      const filename = filePath.split("/").pop() || ""
      sessionId = filename.replace(/\.jsonl$/, "")
    }

    return { sessionId, hasStartTask, hasEndTask, createdAt }
  } catch {
    return null
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Find an incomplete session for a given task.
 *
 * Scans session JSONL files in the storage directory for the given app namespace.
 * A session is "incomplete" if it contains a `<start_task>{taskId}</start_task>` marker
 * but no corresponding `<end_task>{taskId}</end_task>` marker.
 *
 * @param taskId - The task ID to search for (e.g., "r-abc123" or "r-abc123.2")
 * @param app - The app namespace (e.g., "ralph")
 * @param storageDir - The base storage directory for sessions
 * @returns The sessionId of an incomplete session, or null if none found
 */
export function findIncompleteSession(
  taskId: string,
  app: string,
  storageDir: string,
): string | null {
  if (!existsSync(storageDir)) return null

  const incompleteSessions: SessionTaskInfo[] = []

  // Scan all possible locations for session files

  // 1. Legacy location: {storageDir}/{app}/*.jsonl
  const legacyAppDir = join(storageDir, app)
  if (existsSync(legacyAppDir) && isDirectory(legacyAppDir)) {
    scanDirectory(legacyAppDir, taskId, incompleteSessions)
  }

  // 2. Workspace-scoped: {storageDir}/{owner}/{repo}/{app}/*.jsonl
  // Workspace IDs contain a slash (e.g., "owner/repo")
  const topEntries = safeReaddir(storageDir)
  for (const ownerEntry of topEntries) {
    const ownerPath = join(storageDir, ownerEntry)
    if (!isDirectory(ownerPath)) continue

    const ownerSubEntries = safeReaddir(ownerPath)
    for (const repoEntry of ownerSubEntries) {
      const repoPath = join(ownerPath, repoEntry)
      if (!isDirectory(repoPath)) continue

      const workspaceAppDir = join(repoPath, app)
      if (existsSync(workspaceAppDir) && isDirectory(workspaceAppDir)) {
        scanDirectory(workspaceAppDir, taskId, incompleteSessions)
      }
    }
  }

  // Filter to only incomplete sessions (has start_task but no end_task)
  const incomplete = incompleteSessions.filter(s => s.hasStartTask && !s.hasEndTask)

  if (incomplete.length === 0) return null

  // Return the most recent incomplete session
  incomplete.sort((a, b) => b.createdAt - a.createdAt)
  return incomplete[0].sessionId
}

/**
 * Scan a directory for JSONL session files and extract task info.
 */
function scanDirectory(
  dir: string,
  taskId: string,
  results: SessionTaskInfo[],
): void {
  const files = safeReaddir(dir)
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue
    const filePath = join(dir, file)
    const info = parseSessionForTask(filePath, taskId)
    if (info) {
      results.push(info)
    }
  }
}

/**
 * Safely read a directory, returning empty array on error.
 */
function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/**
 * Check if a path is a directory.
 */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
