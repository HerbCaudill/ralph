import { mkdir, readFile, writeFile, stat } from "node:fs/promises"
import { join, dirname } from "node:path"
import type { RalphStatus } from "./RalphManager.js"

/**
 * Persisted instance metadata.
 *
 * This is the data saved to disk - it excludes runtime state like
 * the RalphManager reference, events, and token usage.
 */
export interface PersistedInstance {
  /** Unique instance ID */
  id: string

  /** Display name for the instance */
  name: string

  /** Workspace path this instance belongs to */
  workspace: string

  /** Agent name for task assignment (e.g., "Ralph-1") */
  agentName: string

  /** Path to the git worktree (null for main workspace) */
  worktreePath: string | null

  /** Git branch name for this instance */
  branch: string | null

  /** Last known status before server shutdown */
  status: RalphStatus

  /** Timestamp when the instance was created */
  createdAt: number

  /** ID of the current task being worked on (if any) */
  currentTaskId: string | null
}

/**
 * Full instance store file format.
 */
interface InstanceStoreData {
  /** Version of the store format (for future migrations) */
  version: 1

  /** Map of instance IDs to their persisted data */
  instances: Record<string, PersistedInstance>
}

/**
 * InstanceStore provides file-based persistence for Ralph instances.
 *
 * Instance metadata is stored in .ralph/instances.json within the workspace.
 * This allows the server to restore running instances on restart.
 *
 * Note: Each workspace has its own InstanceStore. The store path is
 * determined by the workspace path provided at construction time.
 */
export class InstanceStore {
  private workspacePath: string
  private storePath: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.storePath = join(workspacePath, ".ralph", "instances.json")
  }

  /**
   * Get the workspace path this store manages.
   */
  getWorkspacePath(): string {
    return this.workspacePath
  }

  /**
   * Get the path to the store file.
   */
  getStorePath(): string {
    return this.storePath
  }

  /**
   * Ensure the .ralph directory exists.
   */
  private async ensureDir(): Promise<void> {
    const dir = dirname(this.storePath)
    await mkdir(dir, { recursive: true })
  }

  /**
   * Check if the store file exists.
   */
  async exists(): Promise<boolean> {
    try {
      await stat(this.storePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Load the store data from disk.
   * Returns an empty store if the file doesn't exist.
   */
  private async loadData(): Promise<InstanceStoreData> {
    try {
      const content = await readFile(this.storePath, "utf-8")
      const data = JSON.parse(content) as InstanceStoreData

      // Validate version
      if (data.version !== 1) {
        console.warn(`[InstanceStore] Unknown store version: ${data.version}, creating fresh store`)
        return this.createEmptyData()
      }

      return data
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return this.createEmptyData()
      }
      throw err
    }
  }

  /**
   * Create an empty store data object.
   */
  private createEmptyData(): InstanceStoreData {
    return {
      version: 1,
      instances: {},
    }
  }

  /**
   * Save the store data to disk.
   */
  private async saveData(data: InstanceStoreData): Promise<void> {
    await this.ensureDir()
    await writeFile(this.storePath, JSON.stringify(data, null, 2), "utf-8")
  }

  /**
   * Get all persisted instances.
   */
  async getAll(): Promise<PersistedInstance[]> {
    const data = await this.loadData()
    return Object.values(data.instances)
  }

  /**
   * Get a persisted instance by ID.
   * Returns null if not found.
   */
  async get(instanceId: string): Promise<PersistedInstance | null> {
    const data = await this.loadData()
    return data.instances[instanceId] ?? null
  }

  /**
   * Check if an instance exists in the store.
   */
  async has(instanceId: string): Promise<boolean> {
    const data = await this.loadData()
    return instanceId in data.instances
  }

  /**
   * Save or update an instance.
   */
  async save(instance: PersistedInstance): Promise<void> {
    const data = await this.loadData()
    data.instances[instance.id] = instance
    await this.saveData(data)
  }

  /**
   * Save multiple instances at once (more efficient for bulk updates).
   */
  async saveAll(instances: PersistedInstance[]): Promise<void> {
    const data = await this.loadData()
    for (const instance of instances) {
      data.instances[instance.id] = instance
    }
    await this.saveData(data)
  }

  /**
   * Update specific fields of an instance.
   * Returns the updated instance, or null if not found.
   */
  async update(
    instanceId: string,
    updates: Partial<Omit<PersistedInstance, "id">>,
  ): Promise<PersistedInstance | null> {
    const data = await this.loadData()
    const instance = data.instances[instanceId]
    if (!instance) {
      return null
    }

    const updated: PersistedInstance = {
      ...instance,
      ...updates,
    }
    data.instances[instanceId] = updated
    await this.saveData(data)
    return updated
  }

  /**
   * Remove an instance from the store.
   * Returns true if the instance was removed, false if not found.
   */
  async remove(instanceId: string): Promise<boolean> {
    const data = await this.loadData()
    if (!(instanceId in data.instances)) {
      return false
    }
    delete data.instances[instanceId]
    await this.saveData(data)
    return true
  }

  /**
   * Remove all instances from the store.
   */
  async clear(): Promise<void> {
    await this.saveData(this.createEmptyData())
  }

  /**
   * Get the count of instances in the store.
   */
  async count(): Promise<number> {
    const data = await this.loadData()
    return Object.keys(data.instances).length
  }

  /**
   * Get all instances that were running (status !== "stopped") before shutdown.
   * Used for restoring instances on server restart.
   */
  async getRunningInstances(): Promise<PersistedInstance[]> {
    const instances = await this.getAll()
    return instances.filter(i => i.status !== "stopped")
  }

  /**
   * Mark all instances as stopped.
   * Used when server shuts down cleanly to prevent false "running" states.
   */
  async markAllStopped(): Promise<void> {
    const data = await this.loadData()
    for (const instance of Object.values(data.instances)) {
      instance.status = "stopped"
    }
    await this.saveData(data)
  }

  /**
   * Update the status of an instance.
   * Returns true if updated, false if instance not found.
   */
  async updateStatus(instanceId: string, status: RalphStatus): Promise<boolean> {
    const updated = await this.update(instanceId, { status })
    return updated !== null
  }

  /**
   * Update the current task ID of an instance.
   * Returns true if updated, false if instance not found.
   */
  async updateCurrentTask(instanceId: string, currentTaskId: string | null): Promise<boolean> {
    const updated = await this.update(instanceId, { currentTaskId })
    return updated !== null
  }
}

// Store instances per workspace path
const instanceStores = new Map<string, InstanceStore>()

/**
 * Get the InstanceStore for a workspace.
 * Creates a new store if one doesn't exist for the workspace.
 *
 * @param workspacePath - The workspace path
 * @returns The InstanceStore for the workspace
 */
export function getInstanceStore(workspacePath: string): InstanceStore {
  let store = instanceStores.get(workspacePath)
  if (!store) {
    store = new InstanceStore(workspacePath)
    instanceStores.set(workspacePath, store)
  }
  return store
}

/**
 * Reset all InstanceStore instances (for testing).
 */
export function resetInstanceStores(): void {
  instanceStores.clear()
}
