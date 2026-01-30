import { randomBytes } from "node:crypto"
import { appendFile, mkdir, readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import type { TaskChatEvent } from "./TaskChatManager.js"

/**
 * Log file naming: {sessionId}-{timestamp}.jsonl
 * Example: a1b2c3d4-2024-01-15T10-30-00-000Z.jsonl
 */

/**  Generate a short session ID (8 chars) */
function generateSessionId(): string {
  return randomBytes(4).toString("hex")
}

/**  Format timestamp for filename (ISO8601 but with safe chars) */
function formatTimestampForFilename(date: Date): string {
  return date.toISOString().replace(/:/g, "-")
}

/**  Metadata stored with each log entry */
export interface TaskChatLogEntry {
  /** Session ID for grouping related events */
  sessionId: string
  /** Timestamp when the event was logged */
  loggedAt: string
  /** The event data */
  event: TaskChatEvent
}

/**  Summary of a log file (without loading full events) */
export interface TaskChatLogSummary {
  /** Filename (without path) */
  filename: string
  /** Session ID extracted from filename */
  sessionId: string
  /** Timestamp extracted from filename */
  createdAt: string
  /** Full path to the file */
  filePath: string
}

/**  Options for TaskChatEventLog */
export interface TaskChatEventLogOptions {
  /** Workspace directory path */
  workspacePath: string
  /** Subdirectory within .beads for logs (default: "task-chat-logs") */
  logsSubdir?: string
}

/**
 * TaskChatEventLog persists task chat events to JSONL files during browser usage.
 *
 * Events are logged to `.beads/task-chat-logs/` in the workspace directory.
 * Each session creates a new log file named `{sessionId}-{timestamp}.jsonl`.
 *
 * This enables capturing real-world event sequences for replay testing.
 *
 * Usage:
 * ```ts
 * const logger = new TaskChatEventLog({ workspacePath: '/path/to/workspace' })
 * logger.startSession()
 *
 * // Log events as they occur
 * taskChatManager.on('event', (event) => {
 *   logger.log(event)
 * })
 *
 * // End session when done
 * logger.endSession()
 * ```
 */
export class TaskChatEventLog {
  private workspacePath: string
  private logsSubdir: string
  private sessionId: string | null = null
  private logFilePath: string | null = null
  private eventCount = 0

  constructor(options: TaskChatEventLogOptions) {
    this.workspacePath = options.workspacePath
    this.logsSubdir = options.logsSubdir ?? "task-chat-logs"
  }

  /**
   * Get the directory path for log files.
   */
  private get logsDir(): string {
    return join(this.workspacePath, ".beads", this.logsSubdir)
  }

  /**
   * Whether a logging session is active.
   */
  get isLogging(): boolean {
    return this.sessionId !== null
  }

  /**
   * Get the current session ID (null if no session active).
   */
  get currentSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Get the number of events logged in the current session.
   */
  get currentEventCount(): number {
    return this.eventCount
  }

  /**
   * Start a new logging session.
   * Creates a new log file for this session.
   *
   * @returns The session ID
   */
  async startSession(): Promise<string> {
    if (this.sessionId) {
      throw new Error("A logging session is already active. Call endSession() first.")
    }

    // Ensure logs directory exists
    await mkdir(this.logsDir, { recursive: true })

    // Generate session ID and create log file path
    this.sessionId = generateSessionId()
    const timestamp = formatTimestampForFilename(new Date())
    const filename = `${this.sessionId}-${timestamp}.jsonl`
    this.logFilePath = join(this.logsDir, filename)
    this.eventCount = 0

    return this.sessionId
  }

  /**
   * Log an event to the current session.
   *
   * @param event The task chat event to log
   * @throws Error if no session is active
   */
  async log(event: TaskChatEvent): Promise<void> {
    if (!this.sessionId || !this.logFilePath) {
      throw new Error("No logging session active. Call startSession() first.")
    }

    const entry: TaskChatLogEntry = {
      sessionId: this.sessionId,
      loggedAt: new Date().toISOString(),
      event,
    }

    // Append as JSONL (one JSON object per line)
    const line = JSON.stringify(entry) + "\n"
    await appendFile(this.logFilePath, line, "utf-8")
    this.eventCount++
  }

  /**
   * End the current logging session.
   */
  endSession(): void {
    this.sessionId = null
    this.logFilePath = null
    this.eventCount = 0
  }

  /**
   * List all log files in the logs directory.
   *
   * @returns Array of log file summaries, sorted by creation time (newest first)
   */
  async listLogs(): Promise<TaskChatLogSummary[]> {
    try {
      await mkdir(this.logsDir, { recursive: true })
      const files = await readdir(this.logsDir)
      const jsonlFiles = files.filter(f => f.endsWith(".jsonl"))

      const summaries: TaskChatLogSummary[] = []

      for (const filename of jsonlFiles) {
        // Parse filename: {sessionId}-{timestamp}.jsonl
        const match = filename.match(/^([a-f0-9]{8})-(.+)\.jsonl$/)
        if (match) {
          const [, sessionId, timestampPart] = match
          // Convert filename timestamp back to ISO format
          const createdAt = timestampPart.replace(/-/g, (m, offset) => {
            // Replace hyphens at positions that were colons (positions 13, 16)
            // Format: 2024-01-15T10-30-00-000Z
            // Positions: 0123456789...
            if (offset === 13 || offset === 16) return ":"
            return m
          })

          summaries.push({
            filename,
            sessionId,
            createdAt,
            filePath: join(this.logsDir, filename),
          })
        }
      }

      // Sort by createdAt descending (newest first)
      summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return summaries
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw err
    }
  }

  /**
   * Read all events from a log file.
   *
   * @param filePath Path to the log file
   * @returns Array of log entries
   */
  async readLog(filePath: string): Promise<TaskChatLogEntry[]> {
    const content = await readFile(filePath, "utf-8")
    const lines = content.trim().split("\n").filter(Boolean)

    return lines.map(line => JSON.parse(line) as TaskChatLogEntry)
  }
}
