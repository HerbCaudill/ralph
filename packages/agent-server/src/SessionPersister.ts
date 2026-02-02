import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs"
import { appendFile, readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * JSONL-based event persistence for chat sessions.
 * Each session gets its own `.jsonl` file in the storage directory.
 */
export class SessionPersister {
  /** Directory where session JSONL files are stored. */
  private storageDir: string

  constructor(
    /** Directory to store session JSONL files in. */
    storageDir: string,
  ) {
    this.storageDir = storageDir
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true })
    }
  }

  /** Append an event to a session's JSONL file. */
  async appendEvent(
    /** The session ID. */
    sessionId: string,
    /** The event object to persist. */
    event: Record<string, unknown>,
  ): Promise<void> {
    const filePath = this.sessionPath(sessionId)
    const line = JSON.stringify(event) + "\n"
    await appendFile(filePath, line, "utf-8")
  }

  /** Read all events for a session. */
  async readEvents(
    /** The session ID. */
    sessionId: string,
  ): Promise<Record<string, unknown>[]> {
    const filePath = this.sessionPath(sessionId)
    if (!existsSync(filePath)) return []

    const content = await readFile(filePath, "utf-8")
    return content
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as Record<string, unknown>)
  }

  /** Read events since a given timestamp. */
  async readEventsSince(
    /** The session ID. */
    sessionId: string,
    /** Only return events with timestamp >= this value. */
    since: number,
  ): Promise<Record<string, unknown>[]> {
    const events = await this.readEvents(sessionId)
    return events.filter(e => (e.timestamp as number) >= since)
  }

  /** List all session IDs (derived from JSONL filenames). */
  listSessions(): string[] {
    if (!existsSync(this.storageDir)) return []
    return readdirSync(this.storageDir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => f.replace(/\.jsonl$/, ""))
  }

  /** Get the most recently created session ID, or null if none. */
  getLatestSessionId(): string | null {
    const sessions = this.listSessions()
    if (sessions.length === 0) return null

    let latest: { id: string; birthtime: number } | null = null
    for (const id of sessions) {
      const filePath = this.sessionPath(id)
      const stat = statSync(filePath)
      if (!latest || stat.birthtimeMs > latest.birthtime) {
        latest = { id, birthtime: stat.birthtimeMs }
      }
    }
    return latest?.id ?? null
  }

  /** Delete a session's JSONL file. */
  deleteSession(
    /** The session ID. */
    sessionId: string,
  ): void {
    const filePath = this.sessionPath(sessionId)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  /** Read session metadata from the first event (session_created) in the JSONL file. */
  readSessionMetadata(
    /** The session ID. */
    sessionId: string,
  ): { adapter: string; cwd?: string; createdAt: number } | null {
    const filePath = this.sessionPath(sessionId)
    if (!existsSync(filePath)) return null

    try {
      const content = readFileSync(filePath, "utf-8")
      const firstLine = content.split("\n").find(line => line.trim())
      if (!firstLine) return null

      const event = JSON.parse(firstLine) as Record<string, unknown>
      if (event.type === "session_created") {
        return {
          adapter: (event.adapter as string) ?? "claude",
          cwd: event.cwd as string | undefined,
          createdAt: (event.timestamp as number) ?? 0,
        }
      }
      return null
    } catch {
      return null
    }
  }

  /** Check if a session exists. */
  hasSession(
    /** The session ID. */
    sessionId: string,
  ): boolean {
    return existsSync(this.sessionPath(sessionId))
  }

  /** Get the file path for a session. */
  private sessionPath(sessionId: string): string {
    return join(this.storageDir, `${sessionId}.jsonl`)
  }
}
