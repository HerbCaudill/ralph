import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs"
import { appendFile, readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * JSONL-based event persistence for chat sessions.
 * Each session gets its own `.jsonl` file in the storage directory.
 *
 * Directory structure: `{storageDir}/{workspace}/{app}/{sessionId}.jsonl`
 *
 * Both workspace and app are optional:
 * - `{storageDir}/{workspace}/{app}/{sessionId}.jsonl` — workspace + app
 * - `{storageDir}/{workspace}/{sessionId}.jsonl` — workspace only
 * - `{storageDir}/{app}/{sessionId}.jsonl` — app only (legacy)
 * - `{storageDir}/{sessionId}.jsonl` — neither (legacy)
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
    /** Optional workspace identifier (e.g. "owner/repo"). */
    workspace?: string,
  ): Promise<void> {
    const filePath = this.sessionPath(sessionId, app, workspace)
    const dir = this.getDir(app, workspace)
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
    /** Optional workspace identifier. */
    workspace?: string,
  ): Promise<Record<string, unknown>[]> {
    const filePath = this.sessionPath(sessionId, app, workspace)
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
    /** Optional workspace identifier. */
    workspace?: string,
  ): Promise<Record<string, unknown>[]> {
    const events = await this.readEvents(sessionId, app, workspace)
    return events.filter(e => (e.timestamp as number) >= since)
  }

  /**
   * List all session IDs (derived from JSONL filenames).
   * If app is provided, lists sessions only from that app's directory.
   * If workspace is provided, scopes to that workspace.
   */
  listSessions(
    /** Optional app namespace filter. */
    app?: string,
    /** Optional workspace identifier filter. */
    workspace?: string,
  ): string[] {
    return this.listSessionsWithApp(app, workspace).map(s => s.sessionId)
  }

  /**
   * List all sessions with their app and workspace namespace.
   * If app is provided, lists sessions only from that app's directory.
   * If workspace is provided, scopes to that workspace.
   */
  listSessionsWithApp(
    /** Optional app namespace filter. */
    app?: string,
    /** Optional workspace identifier filter. */
    workspace?: string,
  ): Array<{ sessionId: string; app?: string; workspace?: string }> {
    if (!existsSync(this.storageDir)) return []

    // When both workspace and app are specified, list from the specific directory
    if (workspace !== undefined && app !== undefined) {
      const dir = this.getDir(app, workspace)
      if (!existsSync(dir)) return []
      return readdirSync(dir)
        .filter(f => f.endsWith(".jsonl"))
        .map(f => ({ sessionId: f.replace(/\.jsonl$/, ""), app, workspace }))
    }

    // When only workspace is specified, list all apps under that workspace
    if (workspace !== undefined) {
      return this.listSessionsInWorkspace(workspace)
    }

    // When only app is specified (no workspace), search all workspaces + legacy root
    if (app !== undefined) {
      return this.listSessionsForApp(app)
    }

    // No filters: enumerate everything
    return this.listAllSessions()
  }

  /** Get the most recently created session ID, or null if none. */
  getLatestSessionId(
    /** Optional app namespace filter. */
    app?: string,
    /** Optional workspace identifier filter. */
    workspace?: string,
  ): string | null {
    const sessions = this.listSessionsWithApp(app, workspace)
    if (sessions.length === 0) return null

    let latest: { id: string; birthtime: number } | null = null
    for (const s of sessions) {
      const filePath = this.sessionPath(s.sessionId, s.app, s.workspace)
      if (!existsSync(filePath)) continue
      const stat = statSync(filePath)
      if (!latest || stat.birthtimeMs > latest.birthtime) {
        latest = { id: s.sessionId, birthtime: stat.birthtimeMs }
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
    /** Optional workspace identifier. */
    workspace?: string,
  ): void {
    const filePath = this.sessionPath(sessionId, app, workspace)
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
    /** Optional workspace identifier. */
    workspace?: string,
  ): {
    adapter: string
    cwd?: string
    createdAt: number
    app?: string
    systemPrompt?: string
    allowedTools?: string[]
  } | null {
    const filePath = this.sessionPath(sessionId, app, workspace)
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
    /** Optional workspace identifier. */
    workspace?: string,
  ): boolean {
    return existsSync(this.sessionPath(sessionId, app, workspace))
  }

  /** Get the full file path for a session. */
  getSessionPath(
    /** The session ID. */
    sessionId: string,
    /** Optional app namespace. */
    app?: string,
    /** Optional workspace identifier. */
    workspace?: string,
  ): string {
    return this.sessionPath(sessionId, app, workspace)
  }

  /** Get the directory for a given workspace + app combination. */
  private getDir(app?: string, workspace?: string): string {
    if (workspace && app) return join(this.storageDir, workspace, app)
    if (workspace) return join(this.storageDir, workspace)
    if (app) return join(this.storageDir, app)
    return this.storageDir
  }

  /** Get the file path for a session. */
  private sessionPath(sessionId: string, app?: string, workspace?: string): string {
    return join(this.getDir(app, workspace), `${sessionId}.jsonl`)
  }

  /** List all sessions under a specific workspace directory. */
  private listSessionsInWorkspace(
    /** Workspace identifier. */
    workspace: string,
  ): Array<{ sessionId: string; app?: string; workspace?: string }> {
    const wsDir = join(this.storageDir, workspace)
    if (!existsSync(wsDir)) return []

    const sessions: Array<{ sessionId: string; app?: string; workspace?: string }> = []
    const entries = readdirSync(wsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        // Session directly under workspace (no app)
        sessions.push({
          sessionId: entry.name.replace(/\.jsonl$/, ""),
          workspace,
        })
      } else if (entry.isDirectory()) {
        // App subdirectory under workspace
        const appDir = join(wsDir, entry.name)
        for (const file of readdirSync(appDir)) {
          if (file.endsWith(".jsonl")) {
            sessions.push({
              sessionId: file.replace(/\.jsonl$/, ""),
              app: entry.name,
              workspace,
            })
          }
        }
      }
    }

    return sessions
  }

  /** List sessions for a specific app across all workspaces and legacy root. */
  private listSessionsForApp(
    /** App namespace to filter by. */
    app: string,
  ): Array<{ sessionId: string; app?: string; workspace?: string }> {
    const sessions: Array<{ sessionId: string; app?: string; workspace?: string }> = []

    // Check legacy location: storageDir/{app}/{sessionId}.jsonl
    const legacyAppDir = join(this.storageDir, app)
    if (existsSync(legacyAppDir)) {
      try {
        const stat = statSync(legacyAppDir)
        if (stat.isDirectory()) {
          for (const file of readdirSync(legacyAppDir)) {
            if (file.endsWith(".jsonl")) {
              sessions.push({ sessionId: file.replace(/\.jsonl$/, ""), app })
            }
          }
        }
      } catch {
        // Ignore errors reading legacy directory
      }
    }

    // Check workspace directories: storageDir/{workspace}/{app}/{sessionId}.jsonl
    // Workspace IDs contain a slash (e.g. "owner/repo"), so we look for two-level nesting
    if (existsSync(this.storageDir)) {
      const topEntries = readdirSync(this.storageDir, { withFileTypes: true })
      for (const ownerEntry of topEntries) {
        if (!ownerEntry.isDirectory()) continue
        const ownerDir = join(this.storageDir, ownerEntry.name)
        const ownerSubEntries = readdirSync(ownerDir, { withFileTypes: true })
        for (const repoEntry of ownerSubEntries) {
          if (!repoEntry.isDirectory()) continue
          // Check if this repo dir contains an app dir matching our filter
          const appDir = join(ownerDir, repoEntry.name, app)
          if (existsSync(appDir) && statSync(appDir).isDirectory()) {
            const workspace = `${ownerEntry.name}/${repoEntry.name}`
            for (const file of readdirSync(appDir)) {
              if (file.endsWith(".jsonl")) {
                sessions.push({
                  sessionId: file.replace(/\.jsonl$/, ""),
                  app,
                  workspace,
                })
              }
            }
          }
        }
      }
    }

    return sessions
  }

  /** List all sessions across all workspaces, apps, and legacy locations. */
  private listAllSessions(): Array<{ sessionId: string; app?: string; workspace?: string }> {
    const sessions: Array<{ sessionId: string; app?: string; workspace?: string }> = []
    if (!existsSync(this.storageDir)) return sessions

    const topEntries = readdirSync(this.storageDir, { withFileTypes: true })
    for (const entry of topEntries) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        // Root-level session (no workspace, no app)
        sessions.push({ sessionId: entry.name.replace(/\.jsonl$/, "") })
      } else if (entry.isDirectory()) {
        // Could be a legacy app dir or a workspace owner dir
        const subDir = join(this.storageDir, entry.name)
        const subEntries = readdirSync(subDir, { withFileTypes: true })

        for (const subEntry of subEntries) {
          if (subEntry.isFile() && subEntry.name.endsWith(".jsonl")) {
            // Legacy: storageDir/{app}/{sessionId}.jsonl
            sessions.push({
              sessionId: subEntry.name.replace(/\.jsonl$/, ""),
              app: entry.name,
            })
          } else if (subEntry.isDirectory()) {
            // Could be workspace: storageDir/{owner}/{repo}/...
            const deepDir = join(subDir, subEntry.name)
            const deepEntries = readdirSync(deepDir, { withFileTypes: true })

            for (const deepEntry of deepEntries) {
              if (deepEntry.isFile() && deepEntry.name.endsWith(".jsonl")) {
                // storageDir/{owner}/{repo}/{sessionId}.jsonl (workspace, no app)
                sessions.push({
                  sessionId: deepEntry.name.replace(/\.jsonl$/, ""),
                  workspace: `${entry.name}/${subEntry.name}`,
                })
              } else if (deepEntry.isDirectory()) {
                // storageDir/{owner}/{repo}/{app}/{sessionId}.jsonl
                const appDir = join(deepDir, deepEntry.name)
                for (const file of readdirSync(appDir)) {
                  if (file.endsWith(".jsonl")) {
                    sessions.push({
                      sessionId: file.replace(/\.jsonl$/, ""),
                      app: deepEntry.name,
                      workspace: `${entry.name}/${subEntry.name}`,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    return sessions
  }

  /** Find the session path by searching all known locations. */
  private findSessionPath(sessionId: string): string | null {
    const sessions = this.listAllSessions().filter(s => s.sessionId === sessionId)
    if (sessions.length > 0) {
      return this.sessionPath(sessions[0].sessionId, sessions[0].app, sessions[0].workspace)
    }
    return null
  }
}
