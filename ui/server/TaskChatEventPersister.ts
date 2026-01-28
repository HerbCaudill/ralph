import { mkdir, readFile, writeFile, rm, appendFile, stat } from "node:fs/promises"
import { join } from "node:path"
import type { TaskChatEvent } from "./TaskChatManager.js"

/**
 * TaskChatEventPersister provides file-based persistence for task chat events during active sessions.
 *
 * Events are stored in JSONL format (one JSON object per line) in:
 * {workspacePath}/.ralph/session-task-chat-{instanceId}.jsonl
 *
 * This enables recovery of task chat events on page reload/reconnect by:
 * 1. Appending each event as it arrives (minimal I/O overhead)
 * 2. Reading all events back when reconnecting
 * 3. Deleting the file when the chat is cleared
 *
 * The JSONL format is ideal because:
 * - Appending is an atomic operation (no need to read-modify-write)
 * - Reading is simple (split by newlines, parse each line)
 * - File can grow without rewriting the entire content
 */
export class TaskChatEventPersister {
  private workspacePath: string
  private storeDir: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.storeDir = join(workspacePath, ".ralph")
  }

  /**
   * Get the workspace path this persister manages.
   */
  getWorkspacePath(): string {
    return this.workspacePath
  }

  /**
   * Get the path to the store directory.
   */
  getStoreDir(): string {
    return this.storeDir
  }

  /**
   * Get the path to an instance's task chat event file.
   */
  private getEventFilePath(instanceId: string): string {
    return join(this.storeDir, `session-task-chat-${instanceId}.jsonl`)
  }

  /**
   * Ensure the .ralph directory exists.
   */
  private async ensureDir(): Promise<void> {
    await mkdir(this.storeDir, { recursive: true })
  }

  /**
   * Check if an event file exists for an instance.
   */
  async has(instanceId: string): Promise<boolean> {
    try {
      await stat(this.getEventFilePath(instanceId))
      return true
    } catch {
      return false
    }
  }

  /**
   * Append an event to the event file for an instance.
   *
   * This creates the file if it doesn't exist.
   */
  async appendEvent(instanceId: string, event: TaskChatEvent): Promise<void> {
    await this.ensureDir()

    const line = JSON.stringify(event) + "\n"
    await appendFile(this.getEventFilePath(instanceId), line, "utf-8")
  }

  /**
   * Append multiple events to the event file for an instance.
   *
   * More efficient than calling appendEvent multiple times.
   */
  async appendEvents(instanceId: string, events: TaskChatEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    await this.ensureDir()

    const lines = events.map(e => JSON.stringify(e)).join("\n") + "\n"
    await appendFile(this.getEventFilePath(instanceId), lines, "utf-8")
  }

  /**
   * Read all events from the event file for an instance.
   *
   * Returns empty array if the file doesn't exist or is empty.
   * Invalid lines (non-JSON) are skipped with a warning.
   */
  async readEvents(instanceId: string): Promise<TaskChatEvent[]> {
    try {
      const content = await readFile(this.getEventFilePath(instanceId), "utf-8")
      const lines = content.trim().split("\n")
      const events: TaskChatEvent[] = []

      for (const line of lines) {
        if (!line.trim()) {
          continue // Skip empty lines
        }

        try {
          const event = JSON.parse(line) as TaskChatEvent
          events.push(event)
        } catch {
          console.warn(`[TaskChatEventPersister] Skipping invalid event line for ${instanceId}`)
        }
      }

      return events
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw err
    }
  }

  /**
   * Read events from the event file that are newer than a given timestamp.
   *
   * Useful for reconnection sync to get only events the client is missing.
   */
  async readEventsSince(instanceId: string, timestamp: number): Promise<TaskChatEvent[]> {
    const allEvents = await this.readEvents(instanceId)
    return allEvents.filter(event => event.timestamp > timestamp)
  }

  /**
   * Clear all events for an instance (delete the file).
   *
   * Call this when task chat history is cleared.
   * Returns true if the file was deleted, false if it didn't exist.
   */
  async clear(instanceId: string): Promise<boolean> {
    try {
      await rm(this.getEventFilePath(instanceId))
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false
      }
      throw err
    }
  }

  /**
   * Reset the event file for an instance (delete and recreate empty).
   *
   * Useful when starting a new session.
   */
  async reset(instanceId: string): Promise<void> {
    await this.ensureDir()
    await writeFile(this.getEventFilePath(instanceId), "", "utf-8")
  }

  /**
   * Get the count of events stored for an instance.
   *
   * Returns 0 if the file doesn't exist.
   */
  async getEventCount(instanceId: string): Promise<number> {
    try {
      const content = await readFile(this.getEventFilePath(instanceId), "utf-8")
      if (!content.trim()) {
        return 0
      }
      return content.trim().split("\n").length
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return 0
      }
      throw err
    }
  }

  /**
   * Clear all task chat event files in the .ralph directory.
   *
   * Useful for cleanup during testing or when resetting state.
   */
  async clearAll(): Promise<void> {
    const { readdir } = await import("node:fs/promises")

    try {
      const files = await readdir(this.storeDir)
      const eventFiles = files.filter(
        f => f.startsWith("session-task-chat-") && f.endsWith(".jsonl"),
      )

      for (const file of eventFiles) {
        await rm(join(this.storeDir, file)).catch(() => {
          // Ignore deletion errors
        })
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return // Directory doesn't exist, nothing to clear
      }
      throw err
    }
  }
}

// Store instances per workspace path
const taskChatEventPersisters = new Map<string, TaskChatEventPersister>()

/**
 * Get the TaskChatEventPersister for a workspace.
 * Creates a new persister if one doesn't exist for the workspace.
 */
export function getTaskChatEventPersister(workspacePath: string): TaskChatEventPersister {
  let persister = taskChatEventPersisters.get(workspacePath)
  if (!persister) {
    persister = new TaskChatEventPersister(workspacePath)
    taskChatEventPersisters.set(workspacePath, persister)
  }
  return persister
}

/** Reset all TaskChatEventPersister instances (for testing). */
export function resetTaskChatEventPersisters(): void {
  taskChatEventPersisters.clear()
}
