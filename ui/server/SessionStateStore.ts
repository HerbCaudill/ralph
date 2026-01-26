import { mkdir, readFile, writeFile, readdir, rm, stat } from "node:fs/promises"
import { join } from "node:path"
import type { RalphStatus } from "./RalphManager.js"
import type { ConversationContext } from "./ClaudeAdapter.js"

/**  Maximum age of session state files before they're considered stale (1 hour) */
const STALE_THRESHOLD_MS = 60 * 60 * 1000

/**
 * Persisted session state.
 *
 * This is the data saved to disk to enable resuming sessions
 * after page reloads or disconnections.
 */
export interface PersistedSessionState {
  /** Instance ID this state belongs to */
  instanceId: string

  /** Conversation context from ClaudeAdapter */
  conversationContext: ConversationContext

  /** SDK session ID for potential session resumption */
  sessionId?: string

  /** Current Ralph status at time of save */
  status: RalphStatus

  /** ID of the current task being worked on (if any) */
  currentTaskId: string | null

  /** Timestamp when this state was saved */
  savedAt: number

  /** Version of the state format (for future migrations) */
  version: 1
}

/**
 * SessionStateStore provides file-based persistence for session state.
 *
 * Session state is stored in .ralph/sessions/{instanceId}.json within the workspace.
 * Each instance has its own state file, which is deleted when the session completes
 * or when stale states are cleaned up.
 *
 * Note: Each workspace has its own SessionStateStore. The store path is
 * determined by the workspace path provided at construction time.
 */
export class SessionStateStore {
  private workspacePath: string
  private storeDir: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.storeDir = join(workspacePath, ".ralph", "sessions")
  }

  /**
   * Get the workspace path this store manages.
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
   * Get the path to a specific instance's state file.
   */
  private getStatePath(instanceId: string): string {
    return join(this.storeDir, `${instanceId}.json`)
  }

  /**
   * Ensure the sessions directory exists.
   */
  private async ensureDir(): Promise<void> {
    await mkdir(this.storeDir, { recursive: true })
  }

  /**
   * Check if the store directory exists.
   */
  async exists(): Promise<boolean> {
    try {
      await stat(this.storeDir)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if an instance has saved state.
   */
  async has(instanceId: string): Promise<boolean> {
    try {
      await stat(this.getStatePath(instanceId))
      return true
    } catch {
      return false
    }
  }

  /**
   * Load session state for an instance.
   * Returns null if not found or if the state is malformed.
   */
  async load(instanceId: string): Promise<PersistedSessionState | null> {
    try {
      const content = await readFile(this.getStatePath(instanceId), "utf-8")
      const state = JSON.parse(content) as PersistedSessionState

      // Validate version
      if (state.version !== 1) {
        console.warn(
          `[SessionStateStore] Unknown state version: ${state.version} for instance ${instanceId}, ignoring`,
        )
        return null
      }

      // Validate basic structure
      if (!state.instanceId || !state.conversationContext) {
        console.warn(`[SessionStateStore] Malformed state for instance ${instanceId}, ignoring`)
        return null
      }

      return state
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      console.warn(`[SessionStateStore] Error loading state for instance ${instanceId}:`, err)
      return null
    }
  }

  /**
   * Save session state for an instance.
   */
  async save(state: PersistedSessionState): Promise<void> {
    await this.ensureDir()

    // Ensure savedAt is set and version is correct
    const stateToSave: PersistedSessionState = {
      ...state,
      savedAt: Date.now(),
      version: 1,
    }

    await writeFile(
      this.getStatePath(state.instanceId),
      JSON.stringify(stateToSave, null, 2),
      "utf-8",
    )
  }

  /**
   * Delete session state for an instance.
   * Returns true if deleted, false if not found.
   */
  async delete(instanceId: string): Promise<boolean> {
    try {
      await rm(this.getStatePath(instanceId))
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false
      }
      throw err
    }
  }

  /**
   * Get all saved session states.
   */
  async getAll(): Promise<PersistedSessionState[]> {
    try {
      const files = await readdir(this.storeDir)
      const states: PersistedSessionState[] = []

      for (const file of files) {
        if (file.endsWith(".json")) {
          const instanceId = file.slice(0, -5) // Remove .json
          const state = await this.load(instanceId)
          if (state) {
            states.push(state)
          }
        }
      }

      return states
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw err
    }
  }

  /**
   * Get all instance IDs that have saved state.
   */
  async getAllInstanceIds(): Promise<string[]> {
    try {
      const files = await readdir(this.storeDir)
      return files.filter(f => f.endsWith(".json")).map(f => f.slice(0, -5))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw err
    }
  }

  /**
   * Get the count of saved session states.
   */
  async count(): Promise<number> {
    const ids = await this.getAllInstanceIds()
    return ids.length
  }

  /**
   * Clean up stale session states.
   *
   * Removes states that are older than the stale threshold (default 1 hour).
   * Returns the number of states removed.
   */
  async cleanupStale(
    /** Maximum age in milliseconds (default: 1 hour) */
    thresholdMs: number = STALE_THRESHOLD_MS,
  ): Promise<number> {
    const now = Date.now()
    let removed = 0

    const states = await this.getAll()
    for (const state of states) {
      const age = now - state.savedAt
      if (age > thresholdMs) {
        console.log(
          `[SessionStateStore] Removing stale state for instance ${state.instanceId} (age: ${Math.round(age / 1000 / 60)}m)`,
        )
        await this.delete(state.instanceId)
        removed++
      }
    }

    return removed
  }

  /**
   * Clear all saved session states.
   */
  async clear(): Promise<void> {
    const ids = await this.getAllInstanceIds()
    for (const id of ids) {
      await this.delete(id)
    }
  }
}

// Store instances per workspace path
const sessionStateStores = new Map<string, SessionStateStore>()

/**
 * Get the SessionStateStore for a workspace.
 * Creates a new store if one doesn't exist for the workspace.
 */
export function getSessionStateStore(
  /** The workspace path */
  workspacePath: string,
): SessionStateStore {
  let store = sessionStateStores.get(workspacePath)
  if (!store) {
    store = new SessionStateStore(workspacePath)
    sessionStateStores.set(workspacePath, store)
  }
  return store
}

/**  Reset all SessionStateStore instances (for testing). */
export function resetSessionStateStores(): void {
  sessionStateStores.clear()
}
