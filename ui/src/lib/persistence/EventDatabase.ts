/**
 * IndexedDB storage module for persisting sessions and task chat sessions.
 *
 * Uses the idb library for a cleaner async/await API over IndexedDB.
 * Provides methods to store, retrieve, and manage persisted data.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import {
  PERSISTENCE_SCHEMA_VERSION,
  STORE_NAMES,
  type PersistedEvent,
  type PersistedSession,
  type PersistedTaskChatSession,
  type SyncState,
} from "./types"

/**
 * Database schema definition for idb library.
 * Defines the shape of each object store and its indexes.
 */
interface RalphDBSchema extends DBSchema {
  [STORE_NAMES.SESSIONS]: {
    key: string
    value: PersistedSession
    indexes: {
      "by-instance": string
      "by-started-at": number
      "by-instance-and-started-at": [string, number]
      "by-task": string
      // Note: Records with null workspaceId won't be indexed by this compound index
      "by-workspace-and-started-at": [string, number]
    }
  }
  [STORE_NAMES.EVENTS]: {
    key: string
    value: PersistedEvent
    indexes: {
      "by-session": string
      "by-timestamp": number
    }
  }
  [STORE_NAMES.CHAT_SESSIONS]: {
    key: string
    value: PersistedTaskChatSession
    indexes: {
      "by-instance": string
      "by-task": string
      "by-updated-at": number
      "by-instance-and-task": [string, string]
    }
  }
  [STORE_NAMES.SYNC_STATE]: {
    key: string
    value: SyncState
  }
}

const DB_NAME = "ralph-persistence"

/**
 * EventDatabase provides IndexedDB storage for sessions and task chat sessions.
 *
 * Features:
 * - Separate stores for metadata (fast listing) and full data (lazy loading)
 * - Compound indexes for efficient queries
 * - Transactional updates
 *
 * Note: No migration support - if the schema version changes, users clear IndexedDB.
 */
export class EventDatabase {
  private db: IDBPDatabase<RalphDBSchema> | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the database connection.
   * Creates object stores and indexes on first run.
   */
  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.openDatabase()
    return this.initPromise
  }

  private async openDatabase(): Promise<void> {
    this.db = await openDB<RalphDBSchema>(DB_NAME, PERSISTENCE_SCHEMA_VERSION, {
      upgrade(db) {
        // Create all object stores and indexes for the current schema.
        // No migration support - if the schema version changes, users clear IndexedDB.

        // Sessions store with all indexes
        const sessionsStore = db.createObjectStore(STORE_NAMES.SESSIONS, {
          keyPath: "id",
        })
        sessionsStore.createIndex("by-instance", "instanceId")
        sessionsStore.createIndex("by-started-at", "startedAt")
        sessionsStore.createIndex("by-instance-and-started-at", ["instanceId", "startedAt"])
        sessionsStore.createIndex("by-task", "taskId")
        sessionsStore.createIndex("by-workspace-and-started-at", ["workspaceId", "startedAt"])

        // Chat sessions store with all indexes
        const chatSessionsStore = db.createObjectStore(STORE_NAMES.CHAT_SESSIONS, {
          keyPath: "id",
        })
        chatSessionsStore.createIndex("by-instance", "instanceId")
        chatSessionsStore.createIndex("by-task", "taskId")
        chatSessionsStore.createIndex("by-updated-at", "updatedAt")
        chatSessionsStore.createIndex("by-instance-and-task", ["instanceId", "taskId"])

        // Sync state key-value store
        db.createObjectStore(STORE_NAMES.SYNC_STATE, {
          keyPath: "key",
        })

        // Events store for append-only event writes
        const eventsStore = db.createObjectStore(STORE_NAMES.EVENTS, {
          keyPath: "id",
        })
        eventsStore.createIndex("by-session", "sessionId")
        eventsStore.createIndex("by-timestamp", "timestamp")
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

  // Session Methods

  /**
   * Save a session.
   */
  async saveSession(session: PersistedSession): Promise<void> {
    console.debug(
      `[EventDatabase] saveSession: id=${session.id}, instanceId=${session.instanceId}, eventCount=${session.eventCount}`,
    )
    const db = await this.ensureDb()
    await db.put(STORE_NAMES.SESSIONS, session)
  }

  /**
   * Get session metadata by ID.
   * Returns the session without the events array for backward compatibility.
   */
  async getSessionMetadata(id: string): Promise<PersistedSession | undefined> {
    const db = await this.ensureDb()
    const session = await db.get(STORE_NAMES.SESSIONS, id)
    if (!session) return undefined
    // Return without events array for backward compatibility with metadata consumers
    const { events: _, ...metadata } = session
    return metadata as PersistedSession
  }

  /**
   * Get full session data by ID (including events).
   */
  async getSession(id: string): Promise<PersistedSession | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.SESSIONS, id)
  }

  /**
   * List all session metadata for an instance, sorted by startedAt descending.
   */
  async listSessions(instanceId: string): Promise<PersistedSession[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.SESSIONS, "by-instance", instanceId)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * List all session metadata across all instances, sorted by startedAt descending.
   */
  async listAllSessions(): Promise<PersistedSession[]> {
    const db = await this.ensureDb()
    const all = await db.getAll(STORE_NAMES.SESSIONS)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * Update only the taskId field of an existing session.
   * Used when a ralph_task_started event arrives to immediately associate
   * the session with a task without waiting for session completion.
   *
   * Returns true if the session was found and updated, false otherwise.
   */
  async updateSessionTaskId(sessionId: string, taskId: string): Promise<boolean> {
    const db = await this.ensureDb()
    const session = await db.get(STORE_NAMES.SESSIONS, sessionId)
    if (!session) {
      console.debug(`[EventDatabase] updateSessionTaskId: session not found: id=${sessionId}`)
      return false
    }

    // Only update if taskId is different (avoid unnecessary writes)
    if (session.taskId === taskId) {
      console.debug(
        `[EventDatabase] updateSessionTaskId: taskId already set: id=${sessionId}, taskId=${taskId}`,
      )
      return true
    }

    session.taskId = taskId
    await db.put(STORE_NAMES.SESSIONS, session)
    console.debug(
      `[EventDatabase] updateSessionTaskId: updated session: id=${sessionId}, taskId=${taskId}`,
    )
    return true
  }

  /**
   * Get sessions for a specific task, sorted by startedAt descending.
   */
  async getSessionsForTask(taskId: string): Promise<PersistedSession[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.SESSIONS, "by-task", taskId)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * List all session metadata for a workspace, sorted by startedAt descending.
   * Uses the by-workspace-and-started-at index for efficient retrieval.
   */
  async listSessionsByWorkspace(workspaceId: string): Promise<PersistedSession[]> {
    const db = await this.ensureDb()
    // Use IDBKeyRange to get all sessions with the given workspaceId
    // The compound index is [workspaceId, startedAt], so we query by workspaceId prefix
    const range = IDBKeyRange.bound([workspaceId, 0], [workspaceId, Number.MAX_SAFE_INTEGER])
    const all = await db.getAllFromIndex(STORE_NAMES.SESSIONS, "by-workspace-and-started-at", range)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * Get sessions for a specific task within a workspace, sorted by startedAt descending.
   * Filters by both taskId and workspaceId to ensure cross-workspace isolation.
   */
  async getSessionsForTaskInWorkspace(
    taskId: string,
    workspaceId: string,
  ): Promise<PersistedSession[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.SESSIONS, "by-task", taskId)
    // Filter by workspaceId and sort by startedAt descending
    return all
      .filter(session => session.workspaceId === workspaceId)
      .sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * Derive and update the taskId for a session by scanning its events.
   * Used as a fallback when a session doesn't have a taskId set (e.g., from
   * before the immediate update feature was implemented).
   *
   * Returns the taskId if found and updated, null otherwise.
   */
  async deriveSessionTaskId(sessionId: string): Promise<string | null> {
    const db = await this.ensureDb()
    const session = await db.get(STORE_NAMES.SESSIONS, sessionId)

    if (!session) {
      console.debug(`[EventDatabase] deriveSessionTaskId: session not found: id=${sessionId}`)
      return null
    }

    // Skip if taskId is already set
    if (session.taskId) {
      console.debug(
        `[EventDatabase] deriveSessionTaskId: taskId already set: id=${sessionId}, taskId=${session.taskId}`,
      )
      return session.taskId
    }

    // Get events for this session
    const events = await this.getEventsForSession(sessionId)

    // Find ralph_task_started event and extract taskId
    for (const persistedEvent of events) {
      if (persistedEvent.eventType === "ralph_task_started") {
        const taskId = (persistedEvent.event as { taskId?: string }).taskId
        if (taskId) {
          // Update the session with the derived taskId
          session.taskId = taskId
          await db.put(STORE_NAMES.SESSIONS, session)
          console.debug(
            `[EventDatabase] deriveSessionTaskId: derived and updated: id=${sessionId}, taskId=${taskId}`,
          )
          return taskId
        }
      }
    }

    console.debug(
      `[EventDatabase] deriveSessionTaskId: no ralph_task_started event found: id=${sessionId}`,
    )
    return null
  }

  /**
   * Get the most recent active (incomplete) session for an instance.
   * Returns the most recently started session where completedAt is null.
   */
  async getLatestActiveSession(instanceId: string): Promise<PersistedSession | undefined> {
    const metadata = await this.listSessions(instanceId)

    // Find the most recent session that hasn't completed (sorted by startedAt descending)
    const activeMeta = metadata.find(m => m.completedAt === null)
    if (!activeMeta) return undefined

    return this.getSession(activeMeta.id)
  }

  /**
   * Get the most recent session for an instance (whether complete or not).
   * Useful for hydrating the UI with the last state on page reload.
   */
  async getLatestSession(instanceId: string): Promise<PersistedSession | undefined> {
    const metadata = await this.listSessions(instanceId)
    if (metadata.length === 0) return undefined

    // First entry is the most recent (sorted by startedAt descending)
    return this.getSession(metadata[0].id)
  }

  /**
   * Delete a session and its associated events.
   */
  async deleteSession(id: string): Promise<void> {
    const db = await this.ensureDb()

    // First delete events for this session
    await this.deleteEventsForSession(id)

    // Then delete the session
    await db.delete(STORE_NAMES.SESSIONS, id)
  }

  /**
   * Delete all sessions for an instance (including associated events).
   */
  async deleteAllSessionsForInstance(instanceId: string): Promise<void> {
    const db = await this.ensureDb()

    // Get all session IDs for this instance
    const sessions = await this.listSessions(instanceId)
    const ids = sessions.map(i => i.id)

    // First delete events for all sessions
    await Promise.all(ids.map(id => this.deleteEventsForSession(id)))

    // Then delete sessions
    const tx = db.transaction(STORE_NAMES.SESSIONS, "readwrite")
    const sessionsStore = tx.objectStore(STORE_NAMES.SESSIONS)

    // Delete all entries sequentially within the transaction
    for (const id of ids) {
      await sessionsStore.delete(id)
    }
    await tx.done
  }

  // Event Methods (for normalized event storage in v3+)

  /**
   * Save a single event to the events store.
   * Used for append-only event writes during streaming.
   */
  async saveEvent(event: PersistedEvent): Promise<void> {
    console.debug(`[EventDatabase] saveEvent: id=${event.id}, type=${event.eventType}`)
    const db = await this.ensureDb()
    await db.put(STORE_NAMES.EVENTS, event)
    console.debug(`[EventDatabase] saveEvent complete: id=${event.id}`)
  }

  /**
   * Save multiple events to the events store in a single transaction.
   * Used for batch imports or initial saves.
   */
  async saveEvents(events: PersistedEvent[]): Promise<void> {
    if (events.length === 0) return

    const db = await this.ensureDb()
    const tx = db.transaction(STORE_NAMES.EVENTS, "readwrite")
    const store = tx.objectStore(STORE_NAMES.EVENTS)

    for (const event of events) {
      await store.put(event)
    }
    await tx.done
  }

  /**
   * Get all events for an session, sorted by timestamp.
   * Uses the by-session index for efficient retrieval.
   */
  async getEventsForSession(sessionId: string): Promise<PersistedEvent[]> {
    const db = await this.ensureDb()
    const events = await db.getAllFromIndex(STORE_NAMES.EVENTS, "by-session", sessionId)
    // Sort by timestamp ascending (chronological order)
    return events.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Get a single event by ID.
   */
  async getEvent(id: string): Promise<PersistedEvent | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.EVENTS, id)
  }

  /**
   * Delete all events for an session.
   * Used when cleaning up an session's data.
   */
  async deleteEventsForSession(sessionId: string): Promise<void> {
    const db = await this.ensureDb()
    const events = await this.getEventsForSession(sessionId)

    if (events.length === 0) return

    const tx = db.transaction(STORE_NAMES.EVENTS, "readwrite")
    const store = tx.objectStore(STORE_NAMES.EVENTS)

    for (const event of events) {
      await store.delete(event.id)
    }
    await tx.done
  }

  /**
   * Count events for an session.
   * More efficient than fetching all events when you only need the count.
   */
  async countEventsForSession(sessionId: string): Promise<number> {
    const db = await this.ensureDb()
    const index = db
      .transaction(STORE_NAMES.EVENTS)
      .objectStore(STORE_NAMES.EVENTS)
      .index("by-session")
    return index.count(sessionId)
  }

  // Task Chat Session Methods

  /**
   * Save a task chat session.
   */
  async saveTaskChatSession(session: PersistedTaskChatSession): Promise<void> {
    const db = await this.ensureDb()
    await db.put(STORE_NAMES.CHAT_SESSIONS, session)
  }

  /**
   * Get task chat session metadata by ID.
   * Returns the session without the messages and events arrays for listing purposes.
   */
  async getTaskChatSessionMetadata(
    id: string,
  ): Promise<Omit<PersistedTaskChatSession, "messages" | "events"> | undefined> {
    const db = await this.ensureDb()
    const session = await db.get(STORE_NAMES.CHAT_SESSIONS, id)
    if (!session) return undefined
    // Return without messages and events for metadata consumers
    const { messages: _, events: __, ...metadata } = session
    return metadata
  }

  /**
   * Get full task chat session data by ID (including messages and events).
   */
  async getTaskChatSession(id: string): Promise<PersistedTaskChatSession | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.CHAT_SESSIONS, id)
  }

  /**
   * List all task chat sessions for an instance, sorted by updatedAt descending.
   * Returns sessions without messages and events for efficiency.
   */
  async listTaskChatSessions(
    instanceId: string,
  ): Promise<Omit<PersistedTaskChatSession, "messages" | "events">[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.CHAT_SESSIONS, "by-instance", instanceId)
    // Sort by updatedAt descending and strip heavy fields
    return all
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ messages: _, events: __, ...metadata }) => metadata)
  }

  /**
   * Get task chat sessions for a specific task, sorted by updatedAt descending.
   * Returns sessions without messages and events for efficiency.
   */
  async getTaskChatSessionsForTask(
    taskId: string,
  ): Promise<Omit<PersistedTaskChatSession, "messages" | "events">[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.CHAT_SESSIONS, "by-task", taskId)
    // Sort by updatedAt descending (most recent first)
    return all
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ messages: _, events: __, ...metadata }) => metadata)
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
    const sessions = await db.getAllFromIndex(STORE_NAMES.CHAT_SESSIONS, "by-instance-and-task", [
      instanceId,
      taskId,
    ])

    if (sessions.length === 0) return undefined

    // Sort by updatedAt descending and get the most recent
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions[0]
  }

  /**
   * Get the most recent task chat session for an instance (across all tasks).
   * Useful for hydrating the UI with the last state on page reload.
   */
  async getLatestTaskChatSessionForInstance(
    instanceId: string,
  ): Promise<PersistedTaskChatSession | undefined> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.CHAT_SESSIONS, "by-instance", instanceId)
    if (all.length === 0) return undefined

    // Sort by updatedAt descending and return the most recent
    all.sort((a, b) => b.updatedAt - a.updatedAt)
    return all[0]
  }

  /**
   * Delete a task chat session and its associated events.
   */
  async deleteTaskChatSession(id: string): Promise<void> {
    const db = await this.ensureDb()

    // First delete events for this session
    await this.deleteEventsForSession(id)

    // Then delete the session
    await db.delete(STORE_NAMES.CHAT_SESSIONS, id)
  }

  /**
   * Delete all task chat sessions for an instance (including associated events).
   */
  async deleteAllTaskChatSessionsForInstance(instanceId: string): Promise<void> {
    const db = await this.ensureDb()

    const sessions = await this.listTaskChatSessions(instanceId)
    const ids = sessions.map(s => s.id)

    // First delete events for all sessions
    await Promise.all(ids.map(id => this.deleteEventsForSession(id)))

    // Then delete sessions
    const tx = db.transaction(STORE_NAMES.CHAT_SESSIONS, "readwrite")
    const store = tx.objectStore(STORE_NAMES.CHAT_SESSIONS)

    // Delete all entries sequentially within the transaction
    for (const id of ids) {
      await store.delete(id)
    }
    await tx.done
  }

  /**
   * Get all unique task IDs that have sessions.
   * Efficient method for checking which tasks have saved sessions.
   */
  async getTaskIdsWithSessions(): Promise<Set<string>> {
    const db = await this.ensureDb()
    const all = await db.getAll(STORE_NAMES.SESSIONS)
    const taskIds = new Set<string>()
    for (const session of all) {
      if (session.taskId) {
        taskIds.add(session.taskId)
      }
    }
    return taskIds
  }

  // Sync State Methods

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

  // Utility Methods

  /**
   * Clear all data from the database.
   * Use with caution - this is destructive.
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDb()
    const tx = db.transaction(
      [STORE_NAMES.SESSIONS, STORE_NAMES.EVENTS, STORE_NAMES.CHAT_SESSIONS, STORE_NAMES.SYNC_STATE],
      "readwrite",
    )

    await tx.objectStore(STORE_NAMES.SESSIONS).clear()
    await tx.objectStore(STORE_NAMES.EVENTS).clear()
    await tx.objectStore(STORE_NAMES.CHAT_SESSIONS).clear()
    await tx.objectStore(STORE_NAMES.SYNC_STATE).clear()
    await tx.done
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
    sessionCount: number
    eventCount: number
    chatSessionCount: number
    syncStateCount: number
  }> {
    const db = await this.ensureDb()

    const [sessionCount, eventCount, chatSessionCount, syncStateCount] = await Promise.all([
      db.count(STORE_NAMES.SESSIONS),
      db.count(STORE_NAMES.EVENTS),
      db.count(STORE_NAMES.CHAT_SESSIONS),
      db.count(STORE_NAMES.SYNC_STATE),
    ])

    return { sessionCount, eventCount, chatSessionCount, syncStateCount }
  }
}

/**
 * Singleton instance of the EventDatabase.
 * Use this for all database operations.
 */
export const eventDatabase = new EventDatabase()
