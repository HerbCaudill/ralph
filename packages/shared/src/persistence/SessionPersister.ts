import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs"
import { appendFile, readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * JSONL-based event persistence for chat sessions.
 * Each session gets its own `.jsonl` file in the storage directory.
 * Sessions can be namespaced by app (e.g., "ralph", "task-chat").
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
    /** Optional app namespace. */
    app?: string,
  ): Promise<void> {
    const filePath = this.sessionPath(sessionId, app)
    // Ensure parent directory exists for app-namespaced sessions
    const dir = this.getAppDir(app)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const line = JSON.stringify(event) + "\n"
    await appendFile(filePath, line, "utf-8")
  }

  /** Read all events for a session. */
  async readEvents(
    /** The session ID. */
    sessionId: string,
    /** Optional app namespace. */
    app?: string,
  ): Promise<Record<string, unknown>[]> {
    const filePath = this.sessionPath(sessionId, app)
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
    /** Optional app namespace. */
    app?: string,
  ): Promise<Record<string, unknown>[]> {
    const events = await this.readEvents(sessionId, app)
    return events.filter(e => (e.timestamp as number) >= since)
  }

  /**
   * List all session IDs (derived from JSONL filenames).
   * If app is provided, lists sessions only from that app's directory.
   * If app is undefined, lists sessions from all directories including root.
   */
  listSessions(app?: string): string[] {
    return this.listSessionsWithApp(app).map(s => s.sessionId)
  }

  /**
   * List all sessions with their app namespace.
   * If app is provided, lists sessions only from that app's directory.
   * If app is undefined, lists sessions from all directories including root.
   */
  listSessionsWithApp(app?: string): Array<{ sessionId: string; app?: string }> {
    if (!existsSync(this.storageDir)) return []

    if (app !== undefined) {
      // List sessions only from the app's directory
      const appDir = this.getAppDir(app)
      if (!existsSync(appDir)) return []
      return readdirSync(appDir)
        .filter(f => f.endsWith(".jsonl"))
        .map(f => ({ sessionId: f.replace(/\.jsonl$/, ""), app }))
    }

    // List sessions from all directories
    const sessions: Array<{ sessionId: string; app?: string }> = []

    // Get root-level sessions
    const entries = readdirSync(this.storageDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        sessions.push({ sessionId: entry.name.replace(/\.jsonl$/, ""), app: undefined })
      } else if (entry.isDirectory()) {
        // Get sessions from app subdirectories
        const appDir = join(this.storageDir, entry.name)
        for (const file of readdirSync(appDir)) {
          if (file.endsWith(".jsonl")) {
            sessions.push({ sessionId: file.replace(/\.jsonl$/, ""), app: entry.name })
          }
        }
      }
    }

    return sessions
  }

  /** Get the most recently created session ID, or null if none. */
  getLatestSessionId(app?: string): string | null {
    const sessions = this.listSessions(app)
    if (sessions.length === 0) return null

    let latest: { id: string; birthtime: number } | null = null
    for (const id of sessions) {
      // Try app-specific path first, then root
      const filePath = app ? this.sessionPath(id, app) : this.findSessionPath(id)
      if (!filePath || !existsSync(filePath)) continue
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
    /** Optional app namespace. */
    app?: string,
  ): void {
    const filePath = this.sessionPath(sessionId, app)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  /** Read session metadata from the first event (session_created) in the JSONL file. */
  readSessionMetadata(
    /** The session ID. */
    sessionId: string,
    /** Optional app namespace. */
    app?: string,
  ): {
    adapter: string
    cwd?: string
    createdAt: number
    app?: string
    systemPrompt?: string
    allowedTools?: string[]
  } | null {
    const filePath = this.sessionPath(sessionId, app)
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
          app: event.app as string | undefined,
          systemPrompt: event.systemPrompt as string | undefined,
          allowedTools: event.allowedTools as string[] | undefined,
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
    /** Optional app namespace. */
    app?: string,
  ): boolean {
    return existsSync(this.sessionPath(sessionId, app))
  }

  /** Get the full file path for a session. */
  getSessionPath(
    /** The session ID. */
    sessionId: string,
    /** Optional app namespace. */
    app?: string,
  ): string {
    return this.sessionPath(sessionId, app)
  }

  /** Get the directory for an app. */
  private getAppDir(app?: string): string {
    return app ? join(this.storageDir, app) : this.storageDir
  }

  /** Get the file path for a session. */
  private sessionPath(sessionId: string, app?: string): string {
    return join(this.getAppDir(app), `${sessionId}.jsonl`)
  }

  /** Find the session path by searching root and app directories. */
  private findSessionPath(sessionId: string): string | null {
    // Check root first
    const rootPath = join(this.storageDir, `${sessionId}.jsonl`)
    if (existsSync(rootPath)) return rootPath

    // Check app subdirectories
    if (existsSync(this.storageDir)) {
      const entries = readdirSync(this.storageDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const appPath = join(this.storageDir, entry.name, `${sessionId}.jsonl`)
          if (existsSync(appPath)) return appPath
        }
      }
    }
    return null
  }
}
