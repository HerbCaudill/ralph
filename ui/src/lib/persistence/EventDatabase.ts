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
    let needsV6Migration = false
    let needsV7Migration = false

    this.db = await openDB<RalphDBSchema>(DB_NAME, PERSISTENCE_SCHEMA_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Version 1: Initial schema
        if (oldVersion < 1) {
          // Sessions store with all indexes (v5+ unified store)
          const sessionsStore = db.createObjectStore(STORE_NAMES.SESSIONS, {
            keyPath: "id",
          })
          sessionsStore.createIndex("by-instance", "instanceId")
          sessionsStore.createIndex("by-started-at", "startedAt")
          sessionsStore.createIndex("by-instance-and-started-at", ["instanceId", "startedAt"])
          sessionsStore.createIndex("by-task", "taskId")
          sessionsStore.createIndex("by-workspace-and-started-at", ["workspaceId", "startedAt"])

          // Chat sessions store with all indexes (v6+ unified store)
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

          // Events store for append-only event writes (added in v3, now part of initial schema)
          const eventsStore = db.createObjectStore(STORE_NAMES.EVENTS, {
            keyPath: "id",
          })
          eventsStore.createIndex("by-session", "sessionId")
          eventsStore.createIndex("by-timestamp", "timestamp")
        }

        // Version 2: Event log stores were added in v2 but are now removed in v4
        // (No action needed for fresh installs - stores don't exist)

        // Version 3: Add events store for normalized event storage and workspace index
        if (oldVersion >= 1 && oldVersion < 3) {
          // Events store for append-only event writes
          db.createObjectStore(STORE_NAMES.EVENTS, {
            keyPath: "id",
          }).createIndex("by-session", "sessionId")
          // Need to get the store again to add the second index
          transaction.objectStore(STORE_NAMES.EVENTS).createIndex("by-timestamp", "timestamp")

          // Add workspace index to session metadata for cross-workspace queries
          // Access the existing store through the upgrade transaction
          // Note: session_metadata still exists in v3, will be removed in v5
          const rawDb = db as unknown as IDBDatabase
          if (rawDb.objectStoreNames.contains("session_metadata")) {
            const sessionMetaStore = transaction.objectStore("session_metadata" as never)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(sessionMetaStore as any).createIndex("by-workspace-and-started-at", [
              "workspaceId",
              "startedAt",
            ])
          }

          // Flag that we need to run the data migration after the upgrade completes
          needsV3Migration = true
        }

        // Version 4: Remove event_log stores (superseded by sessions table)
        if (oldVersion >= 1 && oldVersion < 4) {
          // Delete the event_logs stores if they exist (created in v2)
          // Note: We cast to `unknown` because these stores are no longer in the schema
          // but may exist in databases created with v2/v3
          const rawDb = db as unknown as IDBDatabase
          if (rawDb.objectStoreNames.contains("event_log_metadata")) {
            rawDb.deleteObjectStore("event_log_metadata")
          }
          if (rawDb.objectStoreNames.contains("event_logs")) {
            rawDb.deleteObjectStore("event_logs")
          }
        }

        // Version 5: Remove session_metadata store (merged into sessions)
        if (oldVersion >= 1 && oldVersion < 5) {
          const rawDb = db as unknown as IDBDatabase

          // Add missing indexes to sessions store if upgrading from older version
          const sessionsStore = transaction.objectStore(STORE_NAMES.SESSIONS)
          const existingIndexes = Array.from(sessionsStore.indexNames)

          if (!existingIndexes.includes("by-started-at")) {
            sessionsStore.createIndex("by-started-at", "startedAt")
          }
          if (!existingIndexes.includes("by-instance-and-started-at")) {
            sessionsStore.createIndex("by-instance-and-started-at", ["instanceId", "startedAt"])
          }
          if (!existingIndexes.includes("by-task")) {
            sessionsStore.createIndex("by-task", "taskId")
          }
          if (!existingIndexes.includes("by-workspace-and-started-at")) {
            sessionsStore.createIndex("by-workspace-and-started-at", ["workspaceId", "startedAt"])
          }

          // Delete the session_metadata store if it exists
          if (rawDb.objectStoreNames.contains("session_metadata")) {
            rawDb.deleteObjectStore("session_metadata")
          }
        }

        // Version 6: Merge task_chat_metadata + task_chat_sessions into chat_sessions
        if (oldVersion >= 1 && oldVersion < 6) {
          const rawDb = db as unknown as IDBDatabase

          // Create the new chat_sessions store if it doesn't exist
          if (!rawDb.objectStoreNames.contains(STORE_NAMES.CHAT_SESSIONS)) {
            const chatSessionsStore = db.createObjectStore(STORE_NAMES.CHAT_SESSIONS, {
              keyPath: "id",
            })
            chatSessionsStore.createIndex("by-instance", "instanceId")
            chatSessionsStore.createIndex("by-task", "taskId")
            chatSessionsStore.createIndex("by-updated-at", "updatedAt")
            chatSessionsStore.createIndex("by-instance-and-task", ["instanceId", "taskId"])
          }

          // Flag for post-upgrade data migration (copy data before delete)
          if (rawDb.objectStoreNames.contains("task_chat_sessions")) {
            needsV6Migration = true
          }
        }

        // Version 7: Extract task chat events to the events store (unified event storage)
        if (oldVersion >= 6 && oldVersion < 7) {
          // No schema changes needed - the events store already exists
          // We just need to migrate data (extract events from chat_sessions to events store)
          needsV7Migration = true
        }
      },
      blocked() {
        console.warn("[EventDatabase] Database upgrade blocked by other tabs")
      },
      blocking() {
        console.warn("[EventDatabase] This tab is blocking a database upgrade")
      },
    })

    // Run data migrations after the schema upgrade completes
    if (needsV3Migration) {
      await this.migrateV2ToV3()
    }
    if (needsV6Migration) {
      await this.migrateV5ToV6()
    }
    if (needsV7Migration) {
      await this.migrateV6ToV7()
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

    const tx = this.db.transaction([STORE_NAMES.SESSIONS, STORE_NAMES.EVENTS], "readwrite")

    const sessionsStore = tx.objectStore(STORE_NAMES.SESSIONS)
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

      migratedCount++
    }

    await tx.done

    console.log(
      `[EventDatabase] v2→v3 migration complete: migrated ${migratedCount} sessions, created ${eventCount} events`,
    )
  }

  /**
   * Migrate v5 data to v6 format.
   *
   * This migration:
   * 1. Copies all data from task_chat_sessions to the new chat_sessions store
   * 2. Deletes the old task_chat_metadata and task_chat_sessions stores
   *
   * The new chat_sessions store is a unified store with all indexes.
   */
  private async migrateV5ToV6(): Promise<void> {
    if (!this.db) return

    console.log("[EventDatabase] Starting v5→v6 data migration...")

    // We need to work with the raw database since the old stores are not in our schema
    const rawDb = this.db as unknown as IDBDatabase

    // Check if old stores exist
    const hasOldSessionsStore = rawDb.objectStoreNames.contains("task_chat_sessions")
    const hasOldMetadataStore = rawDb.objectStoreNames.contains("task_chat_metadata")

    if (!hasOldSessionsStore) {
      console.log(
        "[EventDatabase] v5→v6 migration: No old task_chat_sessions store found, skipping",
      )
      return
    }

    // Copy data from old task_chat_sessions to new chat_sessions
    // We need to use raw IndexedDB API since the old store isn't in our typed schema
    const oldData = await new Promise<PersistedTaskChatSession[]>((resolve, reject) => {
      const tx = rawDb.transaction("task_chat_sessions", "readonly")
      const store = tx.objectStore("task_chat_sessions")
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? [])
    })

    // Write to new chat_sessions store
    if (oldData.length > 0) {
      const tx = this.db.transaction(STORE_NAMES.CHAT_SESSIONS, "readwrite")
      const store = tx.objectStore(STORE_NAMES.CHAT_SESSIONS)
      for (const session of oldData) {
        await store.put(session)
      }
      await tx.done
    }

    console.log(
      `[EventDatabase] v5→v6 migration complete: migrated ${oldData.length} task chat sessions`,
    )

    // Note: We cannot delete the old stores here because we're outside the upgrade transaction.
    // The old stores will remain but won't be used. They'll be cleaned up when the user
    // clears their data or on a future schema version that does cleanup.
    if (hasOldMetadataStore) {
      console.log(
        "[EventDatabase] Note: Old task_chat_metadata store exists but cannot be deleted outside upgrade",
      )
    }
    if (hasOldSessionsStore) {
      console.log(
        "[EventDatabase] Note: Old task_chat_sessions store exists but cannot be deleted outside upgrade",
      )
    }
  }

  /**
   * Migrate v6 data to v7 format.
   *
   * This migration:
   * 1. Extracts events from chat_sessions store (where they were embedded in v6)
   * 2. Creates individual PersistedEvent records in the events store
   * 3. Updates chat sessions to remove the events array
   *
   * This is idempotent - sessions that have already been migrated (no events array)
   * will be skipped.
   */
  private async migrateV6ToV7(): Promise<void> {
    if (!this.db) return

    console.log("[EventDatabase] Starting v6→v7 data migration...")

    const tx = this.db.transaction([STORE_NAMES.CHAT_SESSIONS, STORE_NAMES.EVENTS], "readwrite")

    const chatSessionsStore = tx.objectStore(STORE_NAMES.CHAT_SESSIONS)
    const eventsStore = tx.objectStore(STORE_NAMES.EVENTS)

    // Get all chat sessions
    const sessions = await chatSessionsStore.getAll()
    let migratedCount = 0
    let eventCount = 0

    for (const session of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionAny = session as any
      const sessionId = sessionAny.id as string

      // Skip if already migrated (no events array)
      if (!sessionAny.events || !Array.isArray(sessionAny.events)) {
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

      // Update chat session to remove events array
      const updatedSession = { ...sessionAny }
      delete updatedSession.events
      await chatSessionsStore.put(updatedSession)

      migratedCount++
    }

    await tx.done

    console.log(
      `[EventDatabase] v6→v7 migration complete: migrated ${migratedCount} chat sessions, created ${eventCount} events`,
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
   * Get sessions for a specific task, sorted by startedAt descending.
   */
  async getSessionsForTask(taskId: string): Promise<PersistedSession[]> {
    const db = await this.ensureDb()
    const all = await db.getAllFromIndex(STORE_NAMES.SESSIONS, "by-task", taskId)
    // Sort by startedAt descending (most recent first)
    return all.sort((a, b) => b.startedAt - a.startedAt)
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

  // ============================================================================
  // Event Methods (for normalized event storage in v3+)
  // ============================================================================

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

  // ============================================================================
  // Task Chat Session Methods
  // ============================================================================

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
