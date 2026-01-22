import { mkdir, readFile, writeFile, readdir, rm, stat } from "node:fs/promises"
import { join } from "node:path"
import type { RalphStatus } from "./RalphManager.js"
import type { ConversationContext } from "./ClaudeAdapter.js"

/**
 * Maximum age of iteration state files before they're considered stale (1 hour)
 */
const STALE_THRESHOLD_MS = 60 * 60 * 1000

/**
 * Persisted iteration state.
 *
 * This is the data saved to disk to enable resuming iterations
 * after page reloads or disconnections.
 */
export interface PersistedIterationState {
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
 * IterationStateStore provides file-based persistence for iteration state.
 *
 * Iteration state is stored in .ralph/iterations/{instanceId}.json within the workspace.
 * Each instance has its own state file, which is deleted when the iteration completes
 * or when stale states are cleaned up.
 *
 * Note: Each workspace has its own IterationStateStore. The store path is
 * determined by the workspace path provided at construction time.
 */
export class IterationStateStore {
  private workspacePath: string
  private storeDir: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.storeDir = join(workspacePath, ".ralph", "iterations")
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
   * Ensure the iterations directory exists.
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
   * Load iteration state for an instance.
   * Returns null if not found or if the state is malformed.
   */
  async load(instanceId: string): Promise<PersistedIterationState | null> {
    try {
      const content = await readFile(this.getStatePath(instanceId), "utf-8")
      const state = JSON.parse(content) as PersistedIterationState

      // Validate version
      if (state.version !== 1) {
        console.warn(
          `[IterationStateStore] Unknown state version: ${state.version} for instance ${instanceId}, ignoring`,
        )
        return null
      }

      // Validate basic structure
      if (!state.instanceId || !state.conversationContext) {
        console.warn(`[IterationStateStore] Malformed state for instance ${instanceId}, ignoring`)
        return null
      }

      return state
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      console.warn(`[IterationStateStore] Error loading state for instance ${instanceId}:`, err)
      return null
    }
  }

  /**
   * Save iteration state for an instance.
   */
  async save(state: PersistedIterationState): Promise<void> {
    await this.ensureDir()

    // Ensure savedAt is set and version is correct
    const stateToSave: PersistedIterationState = {
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
   * Delete iteration state for an instance.
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
   * Get all saved iteration states.
   */
  async getAll(): Promise<PersistedIterationState[]> {
    try {
      const files = await readdir(this.storeDir)
      const states: PersistedIterationState[] = []

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
   * Get the count of saved iteration states.
   */
  async count(): Promise<number> {
    const ids = await this.getAllInstanceIds()
    return ids.length
  }

  /**
   * Clean up stale iteration states.
   *
   * Removes states that are older than the stale threshold (default 1 hour).
   * Returns the number of states removed.
   *
   * @param thresholdMs - Maximum age in milliseconds (default: 1 hour)
   */
  async cleanupStale(thresholdMs: number = STALE_THRESHOLD_MS): Promise<number> {
    const now = Date.now()
    let removed = 0

    const states = await this.getAll()
    for (const state of states) {
      const age = now - state.savedAt
      if (age > thresholdMs) {
        console.log(
          `[IterationStateStore] Removing stale state for instance ${state.instanceId} (age: ${Math.round(age / 1000 / 60)}m)`,
        )
        await this.delete(state.instanceId)
        removed++
      }
    }

    return removed
  }

  /**
   * Clear all saved iteration states.
   */
  async clear(): Promise<void> {
    const ids = await this.getAllInstanceIds()
    for (const id of ids) {
      await this.delete(id)
    }
  }
}

// Store instances per workspace path
const iterationStateStores = new Map<string, IterationStateStore>()

/**
 * Get the IterationStateStore for a workspace.
 * Creates a new store if one doesn't exist for the workspace.
 *
 * @param workspacePath - The workspace path
 * @returns The IterationStateStore for the workspace
 */
export function getIterationStateStore(workspacePath: string): IterationStateStore {
  let store = iterationStateStores.get(workspacePath)
  if (!store) {
    store = new IterationStateStore(workspacePath)
    iterationStateStores.set(workspacePath, store)
  }
  return store
}

/**
 * Reset all IterationStateStore instances (for testing).
 */
export function resetIterationStateStores(): void {
  iterationStateStores.clear()
}
