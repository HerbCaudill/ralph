/**
 * IndexedDB storage module for persisting iterations and task chat sessions.
 *
 * Uses the idb library for a cleaner async/await API over IndexedDB.
 * Provides methods to store, retrieve, and manage persisted data.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import {
  PERSISTENCE_SCHEMA_VERSION,
  STORE_NAMES,
  type EventLogMetadata,
  type IterationMetadata,
  type PersistedEventLog,
  type PersistedIteration,
  type PersistedTaskChatSession,
  type SyncState,
  type TaskChatSessionMetadata,
} from "./types"

/**
 * Database schema definition for idb library.
 * Defines the shape of each object store and its indexes.
 */
interface RalphDBSchema extends DBSchema {
  [STORE_NAMES.ITERATION_METADATA]: {
    key: string
    value: IterationMetadata
    indexes: {
      "by-instance": string
      "by-started-at": number
      "by-instance-and-started-at": [string, number]
      "by-task": string
    }
  }
  [STORE_NAMES.ITERATIONS]: {
    key: string
    value: PersistedIteration
    indexes: {
      "by-instance": string
    }
  }
  [STORE_NAMES.TASK_CHAT_METADATA]: {
    key: string
    value: TaskChatSessionMetadata
    indexes: {
      "by-instance": string
      "by-task": string
      "by-updated-at": number
      "by-instance-and-task": [string, string]
    }
  }
  [STORE_NAMES.TASK_CHAT_SESSIONS]: {
    key: string
    value: PersistedTaskChatSession
    indexes: {
      "by-instance": string
      "by-task": string
    }
  }
  [STORE_NAMES.EVENT_LOG_METADATA]: {
    key: string
    value: EventLogMetadata
    indexes: {
      "by-task": string
      "by-created-at": number
    }
  }
  [STORE_NAMES.EVENT_LOGS]: {
    key: string
    value: PersistedEventLog
    indexes: {
      "by-task": string
    }
  }
  [STORE_NAMES.SYNC_STATE]: {
    key: string
    value: SyncState
  }
}

const DB_NAME = "ralph-persistence"

/**
 * EventDatabase provides IndexedDB storage for iterations and task chat sessions.
 *
 * Features:
 * - Separate stores for metadata (fast listing) and full data (lazy loading)
 * - Compound indexes for efficient queries
 * - Version migration support
 * - Transactional updates
 */
export class EventDatabase {
  private db: IDBPDatabase<RalphDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the database connection.
   * Creates object stores and indexes on first run or version upgrade.
   */
  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.openDatabase()
    return this.initPromise
  }

  private async openDatabase(): Promise<void> {
    this.db = await openDB<RalphDBSchema>(DB_NAME, PERSISTENCE_SCHEMA_VERSION, {
      upgrade(db, oldVersion, _newVersion) {
        // Version 1: Initial schema
        if (oldVersion < 1) {
          // Iteration metadata store with indexes
          const iterationMetaStore = db.createObjectStore(STORE_NAMES.ITERATION_METADATA, {
            keyPath: "id",
          })
          iterationMetaStore.createIndex("by-instance", "instanceId")
          iterationMetaStore.createIndex("by-started-at", "startedAt")
          iterationMetaStore.createIndex("by-instance-and-started-at", ["instanceId", "startedAt"])
          iterationMetaStore.createIndex("by-task", "taskId")

          // Full iterations store
          const iterationsStore = db.createObjectStore(STORE_NAMES.ITERATIONS, {
            keyPath: "id",
          })
          iterationsStore.createIndex("by-instance", "instanceId")

          // Task chat metadata store with indexes
          const taskChatMetaStore = db.createObjectStore(STORE_NAMES.TASK_CHAT_METADATA, {
            keyPath: "id",
          })
          taskChatMetaStore.createIndex("by-instance", "instanceId")
          taskChatMetaStore.createIndex("by-task", "taskId")
          taskChatMetaStore.createIndex("by-updated-at", "updatedAt")
          taskChatMetaStore.createIndex("by-instance-and-task", ["instanceId", "taskId"])

          // Full task chat sessions store
          const taskChatStore = db.createObjectStore(STORE_NAMES.TASK_CHAT_SESSIONS, {
            keyPath: "id",
          })
          taskChatStore.createIndex("by-instance", "instanceId")
          taskChatStore.createIndex("by-task", "taskId")

          // Sync state key-value store
          db.createObjectStore(STORE_NAMES.SYNC_STATE, {
            keyPath: "key",
          })
        }

        // Version 2: Add event log stores
        if (oldVersion < 2) {
          // Event log metadata store with indexes
          const eventLogMetaStore = db.createObjectStore(STORE_NAMES.EVENT_LOG_METADATA, {
            keyPath: "id",
          })
          eventLogMetaStore.createIndex("by-task", "taskId")
          eventLogMetaStore.createIndex("by-created-at", "createdAt")

          // Full event logs store
          const eventLogStore = db.createObjectStore(STORE_NAMES.EVENT_LOGS, {
            keyPath: "id",
          })
          eventLogStore.createIndex("by-task", "taskId")
        }

        // Future migrations can be added here:
        // if (oldVersion < 3) { ... }
      },
      blocked() {
        console.warn("[EventDatabase] Database upgrade blocked by other tabs")
      },
      blocking() {
        console.warn("[EventDatabase] This tab is blocking a database upgrade")
      },
    })
  }

  /**
   * Ensure database is initialized before operations.
   */
  private async ensureDb(): Promise<IDBPDatabase<RalphDBSchema>> {
    await this.init()
    if (!this.db) {
      throw new Error("Database not initialized")
    }
    return this.db
  }

  // ============================================================================
  // Iteration Methods
  // ============================================================================

  /**
   * Save an iteration (both metadata and full data).
   */
  async saveIteration(iteration: PersistedIteration): Promise<void> {
    const db = await this.ensureDb()

    // Extract metadata
    const metadata: IterationMetadata = {
      id: iteration.id,
      instanceId: iteration.instanceId,
      startedAt: iteration.startedAt,
      completedAt: iteration.completedAt,
      taskId: iteration.taskId,
      taskTitle: iteration.taskTitle,
      tokenUsage: iteration.tokenUsage,
      contextWindow: iteration.contextWindow,
      iteration: iteration.iteration,
      eventCount: iteration.eventCount,
      lastEventSequence: iteration.lastEventSequence,
    }

    // Use a transaction to update both stores atomically
    const tx = db.transaction([STORE_NAMES.ITERATION_METADATA, STORE_NAMES.ITERATIONS], "readwrite")

    await Promise.all([
      tx.objectStore(STORE_NAMES.ITERATION_METADATA).put(metadata),
      tx.objectStore(STORE_NAMES.ITERATIONS).put(iteration),
      tx.done,
    ])
  }

  /**
   * Get iteration metadata by ID.
   */
  async getIterationMetadata(id: string): Promise<IterationMetadata | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.ITERATION_METADATA, id)
  }

  /**
   * Get full iteration data by ID (including events).
   */
  async getIteration(id: string): Promise<PersistedIteration | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.ITERATIONS, id)
  }

  /**
   * List all iteration metadata for an instance, sorted by startedAt descending.
   */
  async listIterations(instanceId: string): Promise<IterationMetadata[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.ITERATION_METADATA, "by-instance", instanceId)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * Get iterations for a specific task.
   */
  async getIterationsForTask(taskId: string): Promise<IterationMetadata[]> {
    const db = await this.ensureDb()
    return db.getAllFromIndex(STORE_NAMES.ITERATION_METADATA, "by-task", taskId)
  }

  /**
   * Get the most recent active (incomplete) iteration for an instance.
   * Returns the most recently started iteration where completedAt is null.
   */
  async getLatestActiveIteration(instanceId: string): Promise<PersistedIteration | undefined> {
    const metadata = await this.listIterations(instanceId)

    // Find the most recent iteration that hasn't completed (sorted by startedAt descending)
    const activeMeta = metadata.find(m => m.completedAt === null)
    if (!activeMeta) return undefined

    return this.getIteration(activeMeta.id)
  }

  /**
   * Get the most recent iteration for an instance (whether complete or not).
   * Useful for hydrating the UI with the last state on page reload.
   */
  async getLatestIteration(instanceId: string): Promise<PersistedIteration | undefined> {
    const metadata = await this.listIterations(instanceId)
    if (metadata.length === 0) return undefined

    // First entry is the most recent (sorted by startedAt descending)
    return this.getIteration(metadata[0].id)
  }

  /**
   * Delete an iteration (both metadata and full data).
   */
  async deleteIteration(id: string): Promise<void> {
    const db = await this.ensureDb()
    const tx = db.transaction([STORE_NAMES.ITERATION_METADATA, STORE_NAMES.ITERATIONS], "readwrite")

    await Promise.all([
      tx.objectStore(STORE_NAMES.ITERATION_METADATA).delete(id),
      tx.objectStore(STORE_NAMES.ITERATIONS).delete(id),
      tx.done,
    ])
  }

  /**
   * Delete all iterations for an instance.
   */
  async deleteAllIterationsForInstance(instanceId: string): Promise<void> {
    const db = await this.ensureDb()

    // Get all iteration IDs for this instance
    const iterations = await this.listIterations(instanceId)
    const ids = iterations.map(i => i.id)

    const tx = db.transaction([STORE_NAMES.ITERATION_METADATA, STORE_NAMES.ITERATIONS], "readwrite")

    const metaStore = tx.objectStore(STORE_NAMES.ITERATION_METADATA)
    const iterStore = tx.objectStore(STORE_NAMES.ITERATIONS)

    await Promise.all([
      ...ids.map(id => metaStore.delete(id)),
      ...ids.map(id => iterStore.delete(id)),
      tx.done,
    ])
  }

  // ============================================================================
  // Task Chat Session Methods
  // ============================================================================

  /**
   * Save a task chat session (both metadata and full data).
   */
  async saveTaskChatSession(session: PersistedTaskChatSession): Promise<void> {
    const db = await this.ensureDb()

    // Extract metadata
    const metadata: TaskChatSessionMetadata = {
      id: session.id,
      taskId: session.taskId,
      taskTitle: session.taskTitle,
      instanceId: session.instanceId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
      eventCount: session.eventCount,
      lastEventSequence: session.lastEventSequence,
    }

    const tx = db.transaction(
      [STORE_NAMES.TASK_CHAT_METADATA, STORE_NAMES.TASK_CHAT_SESSIONS],
      "readwrite",
    )

    await Promise.all([
      tx.objectStore(STORE_NAMES.TASK_CHAT_METADATA).put(metadata),
      tx.objectStore(STORE_NAMES.TASK_CHAT_SESSIONS).put(session),
      tx.done,
    ])
  }

  /**
   * Get task chat session metadata by ID.
   */
  async getTaskChatSessionMetadata(id: string): Promise<TaskChatSessionMetadata | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.TASK_CHAT_METADATA, id)
  }

  /**
   * Get full task chat session data by ID (including messages and events).
   */
  async getTaskChatSession(id: string): Promise<PersistedTaskChatSession | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.TASK_CHAT_SESSIONS, id)
  }

  /**
   * List all task chat session metadata for an instance, sorted by updatedAt descending.
   */
  async listTaskChatSessions(instanceId: string): Promise<TaskChatSessionMetadata[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.TASK_CHAT_METADATA, "by-instance", instanceId)
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * Get task chat sessions for a specific task.
   */
  async getTaskChatSessionsForTask(taskId: string): Promise<TaskChatSessionMetadata[]> {
    const db = await this.ensureDb()
    return db.getAllFromIndex(STORE_NAMES.TASK_CHAT_METADATA, "by-task", taskId)
  }

  /**
   * Get the most recent task chat session for a specific task and instance.
   */
  async getLatestTaskChatSession(
    instanceId: string,
    taskId: string,
  ): Promise<PersistedTaskChatSession | undefined> {
    const db = await this.ensureDb()

    // Use compound index to get sessions for this instance+task
    const metadata = await db.getAllFromIndex(
      STORE_NAMES.TASK_CHAT_METADATA,
      "by-instance-and-task",
      [instanceId, taskId],
    )

    if (metadata.length === 0) return undefined

    // Sort by updatedAt descending and get the most recent
    metadata.sort((a, b) => b.updatedAt - a.updatedAt)
    const latestId = metadata[0].id

    return db.get(STORE_NAMES.TASK_CHAT_SESSIONS, latestId)
  }

  /**
   * Get the most recent task chat session for an instance (across all tasks).
   * Useful for hydrating the UI with the last state on page reload.
   */
  async getLatestTaskChatSessionForInstance(
    instanceId: string,
  ): Promise<PersistedTaskChatSession | undefined> {
    const metadata = await this.listTaskChatSessions(instanceId)
    if (metadata.length === 0) return undefined

    // First entry is the most recent (sorted by updatedAt descending)
    return this.getTaskChatSession(metadata[0].id)
  }

  /**
   * Delete a task chat session (both metadata and full data).
   */
  async deleteTaskChatSession(id: string): Promise<void> {
    const db = await this.ensureDb()
    const tx = db.transaction(
      [STORE_NAMES.TASK_CHAT_METADATA, STORE_NAMES.TASK_CHAT_SESSIONS],
      "readwrite",
    )

    await Promise.all([
      tx.objectStore(STORE_NAMES.TASK_CHAT_METADATA).delete(id),
      tx.objectStore(STORE_NAMES.TASK_CHAT_SESSIONS).delete(id),
      tx.done,
    ])
  }

  /**
   * Delete all task chat sessions for an instance.
   */
  async deleteAllTaskChatSessionsForInstance(instanceId: string): Promise<void> {
    const db = await this.ensureDb()

    const sessions = await this.listTaskChatSessions(instanceId)
    const ids = sessions.map(s => s.id)

    const tx = db.transaction(
      [STORE_NAMES.TASK_CHAT_METADATA, STORE_NAMES.TASK_CHAT_SESSIONS],
      "readwrite",
    )

    const metaStore = tx.objectStore(STORE_NAMES.TASK_CHAT_METADATA)
    const sessionStore = tx.objectStore(STORE_NAMES.TASK_CHAT_SESSIONS)

    await Promise.all([
      ...ids.map(id => metaStore.delete(id)),
      ...ids.map(id => sessionStore.delete(id)),
      tx.done,
    ])
  }

  // ============================================================================
  // Event Log Methods
  // ============================================================================

  /**
   * Save an event log (both metadata and full data).
   */
  async saveEventLog(eventLog: PersistedEventLog): Promise<void> {
    const db = await this.ensureDb()

    // Extract metadata
    const metadata: EventLogMetadata = {
      id: eventLog.id,
      taskId: eventLog.taskId,
      taskTitle: eventLog.taskTitle,
      source: eventLog.source,
      workspacePath: eventLog.workspacePath,
      createdAt: eventLog.createdAt,
      eventCount: eventLog.eventCount,
    }

    const tx = db.transaction([STORE_NAMES.EVENT_LOG_METADATA, STORE_NAMES.EVENT_LOGS], "readwrite")

    await Promise.all([
      tx.objectStore(STORE_NAMES.EVENT_LOG_METADATA).put(metadata),
      tx.objectStore(STORE_NAMES.EVENT_LOGS).put(eventLog),
      tx.done,
    ])
  }

  /**
   * Get event log metadata by ID.
   */
  async getEventLogMetadata(id: string): Promise<EventLogMetadata | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.EVENT_LOG_METADATA, id)
  }

  /**
   * Get full event log data by ID (including events).
   */
  async getEventLog(id: string): Promise<PersistedEventLog | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.EVENT_LOGS, id)
  }

  /**
   * List all event log metadata, sorted by createdAt descending.
   */
  async listEventLogs(): Promise<EventLogMetadata[]> {
    const db = await this.ensureDb()
    const all = await db.getAll(STORE_NAMES.EVENT_LOG_METADATA)
    // Sort by createdAt descending (most recent first)
    return all.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Get event logs for a specific task.
   */
  async getEventLogsForTask(taskId: string): Promise<EventLogMetadata[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.EVENT_LOG_METADATA, "by-task", taskId)
    // Sort by createdAt descending (most recent first)
    return all.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Delete an event log (both metadata and full data).
   */
  async deleteEventLog(id: string): Promise<void> {
    const db = await this.ensureDb()
    const tx = db.transaction([STORE_NAMES.EVENT_LOG_METADATA, STORE_NAMES.EVENT_LOGS], "readwrite")

    await Promise.all([
      tx.objectStore(STORE_NAMES.EVENT_LOG_METADATA).delete(id),
      tx.objectStore(STORE_NAMES.EVENT_LOGS).delete(id),
      tx.done,
    ])
  }

  /**
   * Delete all event logs for a specific task.
   */
  async deleteAllEventLogsForTask(taskId: string): Promise<void> {
    const db = await this.ensureDb()

    const eventLogs = await this.getEventLogsForTask(taskId)
    const ids = eventLogs.map(e => e.id)

    if (ids.length === 0) return

    const tx = db.transaction([STORE_NAMES.EVENT_LOG_METADATA, STORE_NAMES.EVENT_LOGS], "readwrite")

    const metaStore = tx.objectStore(STORE_NAMES.EVENT_LOG_METADATA)
    const logStore = tx.objectStore(STORE_NAMES.EVENT_LOGS)

    await Promise.all([
      ...ids.map(id => metaStore.delete(id)),
      ...ids.map(id => logStore.delete(id)),
      tx.done,
    ])
  }

  // ============================================================================
  // Sync State Methods
  // ============================================================================

  /**
   * Get a sync state value.
   */
  async getSyncState(key: string): Promise<string | number | null> {
    const db = await this.ensureDb()
    const state = await db.get(STORE_NAMES.SYNC_STATE, key)
    return state?.value ?? null
  }

  /**
   * Set a sync state value.
   */
  async setSyncState(key: string, value: string | number | null): Promise<void> {
    const db = await this.ensureDb()
    await db.put(STORE_NAMES.SYNC_STATE, { key, value })
  }

  /**
   * Delete a sync state value.
   */
  async deleteSyncState(key: string): Promise<void> {
    const db = await this.ensureDb()
    await db.delete(STORE_NAMES.SYNC_STATE, key)
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear all data from the database.
   * Use with caution - this is destructive.
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDb()
    const tx = db.transaction(
      [
        STORE_NAMES.ITERATION_METADATA,
        STORE_NAMES.ITERATIONS,
        STORE_NAMES.TASK_CHAT_METADATA,
        STORE_NAMES.TASK_CHAT_SESSIONS,
        STORE_NAMES.EVENT_LOG_METADATA,
        STORE_NAMES.EVENT_LOGS,
        STORE_NAMES.SYNC_STATE,
      ],
      "readwrite",
    )

    await Promise.all([
      tx.objectStore(STORE_NAMES.ITERATION_METADATA).clear(),
      tx.objectStore(STORE_NAMES.ITERATIONS).clear(),
      tx.objectStore(STORE_NAMES.TASK_CHAT_METADATA).clear(),
      tx.objectStore(STORE_NAMES.TASK_CHAT_SESSIONS).clear(),
      tx.objectStore(STORE_NAMES.EVENT_LOG_METADATA).clear(),
      tx.objectStore(STORE_NAMES.EVENT_LOGS).clear(),
      tx.objectStore(STORE_NAMES.SYNC_STATE).clear(),
      tx.done,
    ])
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }

  /**
   * Get database statistics.
   */
  async getStats(): Promise<{
    iterationCount: number
    taskChatSessionCount: number
    eventLogCount: number
    syncStateCount: number
  }> {
    const db = await this.ensureDb()

    const [iterationCount, taskChatSessionCount, eventLogCount, syncStateCount] = await Promise.all(
      [
        db.count(STORE_NAMES.ITERATION_METADATA),
        db.count(STORE_NAMES.TASK_CHAT_METADATA),
        db.count(STORE_NAMES.EVENT_LOG_METADATA),
        db.count(STORE_NAMES.SYNC_STATE),
      ],
    )

    return { iterationCount, taskChatSessionCount, eventLogCount, syncStateCount }
  }
}

/**
 * Singleton instance of the EventDatabase.
 * Use this for all database operations.
 */
export const eventDatabase = new EventDatabase()
