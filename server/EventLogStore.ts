import { randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import type { RalphEvent } from "./RalphManager.js"

// Types

export interface EventLogMetadata {
  taskId?: string
  title?: string
  source?: string
  workspacePath?: string
}

export interface EventLog {
  id: string
  createdAt: string
  events: RalphEvent[]
  metadata?: EventLogMetadata
}

export interface EventLogStoreSummary {
  id: string
  createdAt: string
  eventCount: number
  metadata?: EventLogMetadata
}

// Generate a short, URL-safe ID (8 chars)
function generateId(): string {
  return randomBytes(4).toString("hex")
}

/**
 * EventLogStore provides file-based storage for event logs.
 *
 * Event logs are stored as JSON files in ~/.ralph-ui/eventlogs/
 * Each log is stored in a file named {id}.json
 */
export class EventLogStore {
  private baseDir: string

  constructor(options?: { baseDir?: string }) {
    this.baseDir = options?.baseDir ?? join(homedir(), ".ralph-ui", "eventlogs")
  }

  /**
   * Ensure the storage directory exists.
   */
  private async ensureDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true })
  }

  /**
   * Get the file path for an event log ID.
   */
  private getFilePath(id: string): string {
    return join(this.baseDir, `${id}.json`)
  }

  /**
   * Create a new event log and return it.
   */
  async create(events: RalphEvent[], metadata?: EventLogMetadata): Promise<EventLog> {
    await this.ensureDir()

    const id = generateId()
    const eventLog: EventLog = {
      id,
      createdAt: new Date().toISOString(),
      events,
      metadata,
    }

    const filePath = this.getFilePath(id)
    await writeFile(filePath, JSON.stringify(eventLog, null, 2), "utf-8")

    return eventLog
  }

  /**
   * Get an event log by ID.
   * Returns null if not found.
   */
  async get(id: string): Promise<EventLog | null> {
    try {
      const filePath = this.getFilePath(id)
      const content = await readFile(filePath, "utf-8")
      return JSON.parse(content) as EventLog
    } catch (err) {
      // File doesn't exist or is invalid JSON
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      throw err
    }
  }

  /**
   * List all event logs (summaries only, without full event data).
   * Returns newest first.
   */
  async list(): Promise<EventLogStoreSummary[]> {
    await this.ensureDir()

    const files = await readdir(this.baseDir)
    const jsonFiles = files.filter(f => f.endsWith(".json"))

    const summaries: EventLogStoreSummary[] = []
    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(this.baseDir, file), "utf-8")
        const log = JSON.parse(content) as EventLog
        summaries.push({
          id: log.id,
          createdAt: log.createdAt,
          eventCount: log.events.length,
          metadata: log.metadata,
        })
      } catch {
        // Skip invalid files
      }
    }

    // Sort by createdAt descending (newest first)
    summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return summaries
  }
}

// Singleton instance
let eventLogStore: EventLogStore | null = null

/**
 * Get the singleton EventLogStore instance.
 */
export function getEventLogStore(): EventLogStore {
  if (!eventLogStore) {
    eventLogStore = new EventLogStore()
  }
  return eventLogStore
}

/**
 * Reset the EventLogStore singleton (for testing).
 */
export function resetEventLogStore(): void {
  eventLogStore = null
}
