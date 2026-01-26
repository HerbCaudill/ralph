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
  type EventLogMetadata,
  type SessionMetadata,
  type PersistedEvent,
  type PersistedEventLog,
  type PersistedSession,
  type PersistedTaskChatSession,
  type SyncState,
  type TaskChatSessionMetadata,
} from "./types"

/**
 * Database schema definition for idb library.
 * Defines the shape of each object store and its indexes.
 */
interface RalphDBSchema extends DBSchema {
  [STORE_NAMES.SESSION_METADATA]: {
    key: string
    value: SessionMetadata
    indexes: {
      "by-instance": string
      "by-started-at": number
      "by-instance-and-started-at": [string, number]
      "by-task": string
      // Note: Records with null workspaceId won't be indexed by this compound index
      "by-workspace-and-started-at": [string, number]
    }
  }
  [STORE_NAMES.SESSIONS]: {
    key: string
    value: PersistedSession
    indexes: {
      "by-instance": string
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
 * EventDatabase provides IndexedDB storage for sessions and task chat sessions.
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
    let needsV3Migration = false

    this.db = await openDB<RalphDBSchema>(DB_NAME, PERSISTENCE_SCHEMA_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Version 1: Initial schema
        if (oldVersion < 1) {
          // Session metadata store with indexes
          const sessionMetaStore = db.createObjectStore(STORE_NAMES.SESSION_METADATA, {
            keyPath: "id",
          })
          sessionMetaStore.createIndex("by-instance", "instanceId")
          sessionMetaStore.createIndex("by-started-at", "startedAt")
          sessionMetaStore.createIndex("by-instance-and-started-at", ["instanceId", "startedAt"])
          sessionMetaStore.createIndex("by-task", "taskId")

          // Full sessions store
          const sessionsStore = db.createObjectStore(STORE_NAMES.SESSIONS, {
            keyPath: "id",
          })
          sessionsStore.createIndex("by-instance", "instanceId")

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

        // Version 3: Add events store for normalized event storage and workspace index
        if (oldVersion < 3) {
          // Events store for append-only event writes
          db.createObjectStore(STORE_NAMES.EVENTS, {
            keyPath: "id",
          }).createIndex("by-session", "sessionId")
          // Need to get the store again to add the second index
          transaction.objectStore(STORE_NAMES.EVENTS).createIndex("by-timestamp", "timestamp")

          // Add workspace index to session metadata for cross-workspace queries
          // Access the existing store through the upgrade transaction
          if (db.objectStoreNames.contains(STORE_NAMES.SESSION_METADATA)) {
            const sessionMetaStore = transaction.objectStore(STORE_NAMES.SESSION_METADATA)
            sessionMetaStore.createIndex("by-workspace-and-started-at", [
              "workspaceId",
              "startedAt",
            ])
          }

          // Flag that we need to run the data migration after the upgrade completes
          // Only if we're upgrading from v1 or v2 (not fresh installs)
          if (oldVersion >= 1) {
            needsV3Migration = true
          }
        }

        // Future migrations can be added here:
        // if (oldVersion < 4) { ... }
      },
      blocked() {
        console.warn("[EventDatabase] Database upgrade blocked by other tabs")
      },
      blocking() {
        console.warn("[EventDatabase] This tab is blocking a database upgrade")
      },
    })

    // Run data migration after the schema upgrade completes
    if (needsV3Migration) {
      await this.migrateV2ToV3()
    }
  }

  /**
   * Migrate v2 data to v3 format.
   *
   * This migration:
   * 1. Extracts events from the sessions store (where they were embedded in v2)
   * 2. Creates individual PersistedEvent records in the events store
   * 3. Updates sessions to remove the events array
   * 4. Ensures all sessions have workspaceId (set to null for legacy data)
   *
   * This is idempotent - sessions that have already been migrated (no events array)
   * will be skipped.
   */
  private async migrateV2ToV3(): Promise<void> {
    if (!this.db) return

    console.log("[EventDatabase] Starting v2→v3 data migration...")

    const tx = this.db.transaction(
      [STORE_NAMES.SESSIONS, STORE_NAMES.SESSION_METADATA, STORE_NAMES.EVENTS],
      "readwrite",
    )

    const sessionsStore = tx.objectStore(STORE_NAMES.SESSIONS)
    const metadataStore = tx.objectStore(STORE_NAMES.SESSION_METADATA)
    const eventsStore = tx.objectStore(STORE_NAMES.EVENTS)

    // Get all sessions
    const sessions = await sessionsStore.getAll()
    let migratedCount = 0
    let eventCount = 0

    for (const session of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionAny = session as any
      const sessionId = sessionAny.id as string

      // Skip if already migrated (no events array)
      if (!sessionAny.events || !Array.isArray(sessionAny.events)) {
        // Still ensure workspaceId is set
        if (!("workspaceId" in sessionAny)) {
          sessionAny.workspaceId = null
          await sessionsStore.put(sessionAny)
        }
        continue
      }

      const events = sessionAny.events as Array<{
        type?: string
        timestamp?: number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any
      }>

      // Create individual PersistedEvent records
      for (let index = 0; index < events.length; index++) {
        const event = events[index]
        const eventId = `${sessionId}-event-${index}`
        const persistedEvent: PersistedEvent = {
          id: eventId,
          sessionId,
          timestamp: event.timestamp ?? Date.now(),
          eventType: event.type ?? "unknown",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: event as any,
        }
        await eventsStore.put(persistedEvent)
        eventCount++
      }

      // Update session to remove events array
      const updatedSession = { ...sessionAny }
      delete updatedSession.events
      // Ensure workspaceId is set (null for legacy data)
      if (!("workspaceId" in updatedSession)) {
        updatedSession.workspaceId = null
      }
      await sessionsStore.put(updatedSession)

      // Update metadata to ensure workspaceId is set
      const metadata = await metadataStore.get(sessionId)
      if (metadata !== undefined && !("workspaceId" in metadata)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadataWithWorkspace = { ...(metadata as any), workspaceId: null }
        await metadataStore.put(metadataWithWorkspace)
      }

      migratedCount++
    }

    await tx.done

    console.log(
      `[EventDatabase] v2→v3 migration complete: migrated ${migratedCount} sessions, created ${eventCount} events`,
    )
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
  // Session Methods
  // ============================================================================

  /**
   * Save an session (both metadata and full data).
   */
  async saveSession(session: PersistedSession): Promise<void> {
    const db = await this.ensureDb()

    // Extract metadata
    const metadata: SessionMetadata = {
      id: session.id,
      instanceId: session.instanceId,
      workspaceId: session.workspaceId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      taskId: session.taskId,
      taskTitle: session.taskTitle,
      tokenUsage: session.tokenUsage,
      contextWindow: session.contextWindow,
      session: session.session,
      eventCount: session.eventCount,
      lastEventSequence: session.lastEventSequence,
    }

    // Use a transaction to update both stores atomically
    const tx = db.transaction([STORE_NAMES.SESSION_METADATA, STORE_NAMES.SESSIONS], "readwrite")

    await Promise.all([
      tx.objectStore(STORE_NAMES.SESSION_METADATA).put(metadata),
      tx.objectStore(STORE_NAMES.SESSIONS).put(session),
      tx.done,
    ])
  }

  /**
   * Get session metadata by ID.
   */
  async getSessionMetadata(id: string): Promise<SessionMetadata | undefined> {
    const db = await this.ensureDb()
    return db.get(STORE_NAMES.SESSION_METADATA, id)
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
  async listSessions(instanceId: string): Promise<SessionMetadata[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.SESSION_METADATA, "by-instance", instanceId)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * List all session metadata across all instances, sorted by startedAt descending.
   */
  async listAllSessions(): Promise<SessionMetadata[]> {
    const db = await this.ensureDb()
    const all = await db.getAll(STORE_NAMES.SESSION_METADATA)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
  }

  /**
   * Get sessions for a specific task.
   */
  async getSessionsForTask(taskId: string): Promise<SessionMetadata[]> {
    const db = await this.ensureDb()
    return db.getAllFromIndex(STORE_NAMES.SESSION_METADATA, "by-task", taskId)
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
   * Delete an session (metadata, full data, and associated events).
   */
  async deleteSession(id: string): Promise<void> {
    const db = await this.ensureDb()

    // First delete events for this session
    await this.deleteEventsForSession(id)

    // Then delete the session metadata and data
    const tx = db.transaction([STORE_NAMES.SESSION_METADATA, STORE_NAMES.SESSIONS], "readwrite")

    await Promise.all([
      tx.objectStore(STORE_NAMES.SESSION_METADATA).delete(id),
      tx.objectStore(STORE_NAMES.SESSIONS).delete(id),
      tx.done,
    ])
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

    // Then delete session metadata and data
    const tx = db.transaction([STORE_NAMES.SESSION_METADATA, STORE_NAMES.SESSIONS], "readwrite")

    const metaStore = tx.objectStore(STORE_NAMES.SESSION_METADATA)
    const iterStore = tx.objectStore(STORE_NAMES.SESSIONS)

    await Promise.all([
      ...ids.map(id => metaStore.delete(id)),
      ...ids.map(id => iterStore.delete(id)),
      tx.done,
    ])
  }

  // ============================================================================
  // Event Methods (for normalized event storage in v3+)
  // ============================================================================

  /**
   * Save a single event to the events store.
   * Used for append-only event writes during streaming.
   */
  async saveEvent(event: PersistedEvent): Promise<void> {
    const db = await this.ensureDb()
    await db.put(STORE_NAMES.EVENTS, event)
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

    await Promise.all([...events.map(event => store.put(event)), tx.done])
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

    await Promise.all([...events.map(event => store.delete(event.id)), tx.done])
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
   * Get all unique task IDs that have event logs.
   * Efficient method for checking which tasks have sessions.
   */
  async getTaskIdsWithEventLogs(): Promise<Set<string>> {
    const db = await this.ensureDb()
    const all = await db.getAll(STORE_NAMES.EVENT_LOG_METADATA)
    const taskIds = new Set<string>()
    for (const meta of all) {
      if (meta.taskId) {
        taskIds.add(meta.taskId)
      }
    }
    return taskIds
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
        STORE_NAMES.SESSION_METADATA,
        STORE_NAMES.SESSIONS,
        STORE_NAMES.EVENTS,
        STORE_NAMES.TASK_CHAT_METADATA,
        STORE_NAMES.TASK_CHAT_SESSIONS,
        STORE_NAMES.EVENT_LOG_METADATA,
        STORE_NAMES.EVENT_LOGS,
        STORE_NAMES.SYNC_STATE,
      ],
      "readwrite",
    )

    await Promise.all([
      tx.objectStore(STORE_NAMES.SESSION_METADATA).clear(),
      tx.objectStore(STORE_NAMES.SESSIONS).clear(),
      tx.objectStore(STORE_NAMES.EVENTS).clear(),
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
    sessionCount: number
    eventCount: number
    taskChatSessionCount: number
    eventLogCount: number
    syncStateCount: number
  }> {
    const db = await this.ensureDb()

    const [sessionCount, eventCount, taskChatSessionCount, eventLogCount, syncStateCount] =
      await Promise.all([
        db.count(STORE_NAMES.SESSION_METADATA),
        db.count(STORE_NAMES.EVENTS),
        db.count(STORE_NAMES.TASK_CHAT_METADATA),
        db.count(STORE_NAMES.EVENT_LOG_METADATA),
        db.count(STORE_NAMES.SYNC_STATE),
      ])

    return { sessionCount, eventCount, taskChatSessionCount, eventLogCount, syncStateCount }
  }
}

/**
 * Singleton instance of the EventDatabase.
 * Use this for all database operations.
 */
export const eventDatabase = new EventDatabase()
