/**
 * State export utility for capturing full application state.
 *
 * Exports both:
 * - Persisted Zustand state from localStorage
 * - Full contents of IndexedDB stores
 *
 * The exported JSON can be used as source data for Storybook stories
 * or for debugging purposes.
 */

import { eventDatabase } from "./persistence/EventDatabase"
import { PERSIST_NAME } from "@/store/persist"
import { STORE_NAMES, PERSISTENCE_SCHEMA_VERSION } from "./persistence/types"

/**
 * Shape of the exported state JSON file.
 */
export interface ExportedState {
  /** Export metadata */
  meta: {
    /** ISO timestamp of when the export was created */
    exportedAt: string
    /** Version of the export format */
    version: 1
    /** Schema version of the IndexedDB database */
    indexedDbSchemaVersion: number
    /** Name of the localStorage key */
    localStorageKey: string
  }
  /** Raw localStorage state (as parsed JSON) */
  localStorage: unknown
  /** All IndexedDB data by store name */
  indexedDb: {
    iteration_metadata: unknown[]
    iterations: unknown[]
    task_chat_metadata: unknown[]
    task_chat_sessions: unknown[]
    event_log_metadata: unknown[]
    event_logs: unknown[]
    sync_state: unknown[]
  }
}

/**
 * Exports all persisted application state as a single JSON object.
 *
 * Captures:
 * - localStorage state (Zustand persisted state)
 * - All IndexedDB stores (iterations, task chat sessions, event logs, sync state)
 *
 * @returns Promise resolving to the complete exported state
 * @throws Error if IndexedDB access fails
 */
export async function exportState(): Promise<ExportedState> {
  // Get localStorage state
  let localStorageState: unknown = null
  try {
    const raw = localStorage.getItem(PERSIST_NAME)
    if (raw) {
      localStorageState = JSON.parse(raw)
    }
  } catch {
    // localStorage may not be available or contain invalid JSON
    localStorageState = null
  }

  // Initialize database connection if needed
  await eventDatabase.init()

  // Access the underlying IDB database to get all records from each store
  const db = await getDatabase()

  // Read all data from each store
  const [
    iterationMetadata,
    iterations,
    taskChatMetadata,
    taskChatSessions,
    eventLogMetadata,
    eventLogs,
    syncState,
  ] = await Promise.all([
    getAllFromStore(db, STORE_NAMES.ITERATION_METADATA),
    getAllFromStore(db, STORE_NAMES.ITERATIONS),
    getAllFromStore(db, STORE_NAMES.TASK_CHAT_METADATA),
    getAllFromStore(db, STORE_NAMES.TASK_CHAT_SESSIONS),
    getAllFromStore(db, STORE_NAMES.EVENT_LOG_METADATA),
    getAllFromStore(db, STORE_NAMES.EVENT_LOGS),
    getAllFromStore(db, STORE_NAMES.SYNC_STATE),
  ])

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      version: 1,
      indexedDbSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
      localStorageKey: PERSIST_NAME,
    },
    localStorage: localStorageState,
    indexedDb: {
      iteration_metadata: iterationMetadata,
      iterations: iterations,
      task_chat_metadata: taskChatMetadata,
      task_chat_sessions: taskChatSessions,
      event_log_metadata: eventLogMetadata,
      event_logs: eventLogs,
      sync_state: syncState,
    },
  }
}

/**
 * Exports state and triggers a file download in the browser.
 *
 * @param filename - Optional filename (defaults to ralph-state-{timestamp}.json)
 */
export async function downloadStateExport(filename?: string): Promise<void> {
  const state = await exportState()

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const finalFilename = filename ?? `ralph-state-${timestamp}.json`

  const json = JSON.stringify(state, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = finalFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================================================
// Internal helpers for direct IndexedDB access
// ============================================================================

const DB_NAME = "ralph-persistence"

/**
 * Opens a connection to the IndexedDB database.
 * We open a new connection here rather than using eventDatabase's internal
 * connection to avoid coupling to its implementation details.
 */
async function getDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, PERSISTENCE_SCHEMA_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    // Don't handle upgrade - we're just reading, db should already exist
  })
}

/**
 * Gets all records from a specific object store.
 */
async function getAllFromStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, "readonly")
      const store = transaction.objectStore(storeName)
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? [])
    } catch {
      // Store might not exist if db hasn't been fully initialized
      resolve([])
    }
  })
}
