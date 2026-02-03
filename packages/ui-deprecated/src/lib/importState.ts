/**
 * State import utility for restoring application state from exported JSON.
 *
 * This module handles:
 * - Decompressing gzipped state files
 * - Restoring localStorage state (Zustand persisted state)
 * - Populating IndexedDB stores (sessions, events, chat_sessions, sync_state)
 *
 * Used primarily by Storybook for rendering the app with captured production state.
 */

import { gunzipSync } from "fflate"
import { PERSIST_NAME } from "@/store/persist"
import type { ExportedState } from "./exportState"
import {
  PERSISTENCE_SCHEMA_VERSION,
  STORE_NAMES,
  type PersistedSession,
  type PersistedEvent,
  type PersistedTaskChatSession,
  type SyncState,
} from "./persistence/types"

const DB_NAME = "ralph-persistence"

/**
 * Fetches and decompresses a gzipped state file from a URL.
 *
 * @param url - URL to the .json.gz file
 * @returns The parsed ExportedState object
 * @throws Error if fetch fails or decompression fails
 */
export async function fetchCompressedState(url: string): Promise<ExportedState> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch state file: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const compressed = new Uint8Array(arrayBuffer)

  // Decompress using fflate
  const decompressed = gunzipSync(compressed)

  // Decode to string and parse JSON
  const decoder = new TextDecoder()
  const jsonString = decoder.decode(decompressed)

  return JSON.parse(jsonString) as ExportedState
}

/**
 * Restores localStorage state from an exported state object.
 *
 * @param state - The exported state containing localStorage data
 */
export function restoreLocalStorage(state: ExportedState): void {
  if (state.localStorage === null || state.localStorage === undefined) {
    return
  }

  // Write the localStorage state back to the correct key
  const key = state.meta.localStorageKey || PERSIST_NAME
  localStorage.setItem(key, JSON.stringify(state.localStorage))
}

/**
 * Opens or creates the IndexedDB database with the correct schema.
 * This is similar to EventDatabase but doesn't use the idb library
 * to avoid conflicts with the singleton instance.
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, PERSISTENCE_SCHEMA_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    // Handle upgrade - create stores if they don't exist
    request.onupgradeneeded = event => {
      const db = request.result
      const oldVersion = event.oldVersion

      // Create stores if this is a fresh database or upgrading from before stores existed
      if (oldVersion < 1) {
        // Sessions store
        const sessionsStore = db.createObjectStore(STORE_NAMES.SESSIONS, {
          keyPath: "id",
        })
        sessionsStore.createIndex("by-instance", "instanceId")
        sessionsStore.createIndex("by-started-at", "startedAt")
        sessionsStore.createIndex("by-instance-and-started-at", ["instanceId", "startedAt"])
        sessionsStore.createIndex("by-task", "taskId")
        sessionsStore.createIndex("by-workspace-and-started-at", ["workspaceId", "startedAt"])

        // Chat sessions store
        const chatSessionsStore = db.createObjectStore(STORE_NAMES.CHAT_SESSIONS, {
          keyPath: "id",
        })
        chatSessionsStore.createIndex("by-instance", "instanceId")
        chatSessionsStore.createIndex("by-task", "taskId")
        chatSessionsStore.createIndex("by-updated-at", "updatedAt")
        chatSessionsStore.createIndex("by-instance-and-task", ["instanceId", "taskId"])
        chatSessionsStore.createIndex("by-workspace-and-updated-at", ["workspaceId", "updatedAt"])

        // Sync state store
        db.createObjectStore(STORE_NAMES.SYNC_STATE, {
          keyPath: "key",
        })

        // Events store
        const eventsStore = db.createObjectStore(STORE_NAMES.EVENTS, {
          keyPath: "id",
        })
        eventsStore.createIndex("by-session", "sessionId")
        eventsStore.createIndex("by-timestamp", "timestamp")
      }
    }
  })
}

/**
 * Clears all data from an IndexedDB object store.
 */
async function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, "readwrite")
      const store = transaction.objectStore(storeName)
      const request = store.clear()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    } catch {
      // Store might not exist
      resolve()
    }
  })
}

/**
 * Puts multiple records into an IndexedDB object store.
 */
async function putRecords(db: IDBDatabase, storeName: string, records: unknown[]): Promise<void> {
  if (records.length === 0) return

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, "readwrite")
      const store = transaction.objectStore(storeName)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)

      for (const record of records) {
        store.put(record)
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Restores IndexedDB state from an exported state object.
 *
 * Clears existing data and replaces it with the exported data.
 *
 * @param state - The exported state containing IndexedDB data
 */
export async function restoreIndexedDB(state: ExportedState): Promise<void> {
  const db = await openDatabase()

  try {
    // Clear all stores first
    await Promise.all([
      clearStore(db, STORE_NAMES.SESSIONS),
      clearStore(db, STORE_NAMES.EVENTS),
      clearStore(db, STORE_NAMES.CHAT_SESSIONS),
      clearStore(db, STORE_NAMES.SYNC_STATE),
    ])

    // Restore data to each store
    await Promise.all([
      putRecords(db, STORE_NAMES.SESSIONS, state.indexedDb.sessions as PersistedSession[]),
      putRecords(db, STORE_NAMES.EVENTS, state.indexedDb.events as PersistedEvent[]),
      putRecords(
        db,
        STORE_NAMES.CHAT_SESSIONS,
        state.indexedDb.chat_sessions as PersistedTaskChatSession[],
      ),
      putRecords(db, STORE_NAMES.SYNC_STATE, state.indexedDb.sync_state as SyncState[]),
    ])
  } finally {
    db.close()
  }
}

/**
 * Imports complete application state from an exported state object.
 *
 * This restores both localStorage and IndexedDB state, allowing the app
 * to render with the exact state that was exported.
 *
 * @param state - The complete exported state
 */
export async function importState(state: ExportedState): Promise<void> {
  // Restore localStorage first (Zustand state)
  restoreLocalStorage(state)

  // Then restore IndexedDB (sessions, events, etc.)
  await restoreIndexedDB(state)
}

/**
 * Fetches a compressed state file and imports it.
 *
 * Convenience function that combines fetching and importing.
 *
 * @param url - URL to the .json.gz state file
 */
export async function importStateFromUrl(url: string): Promise<void> {
  const state = await fetchCompressedState(url)
  await importState(state)
}

/**
 * Clears all imported state (both localStorage and IndexedDB).
 *
 * Useful for cleanup after Storybook stories.
 */
export async function clearImportedState(): Promise<void> {
  // Clear localStorage
  localStorage.removeItem(PERSIST_NAME)

  // Clear IndexedDB
  const db = await openDatabase()
  try {
    await Promise.all([
      clearStore(db, STORE_NAMES.SESSIONS),
      clearStore(db, STORE_NAMES.EVENTS),
      clearStore(db, STORE_NAMES.CHAT_SESSIONS),
      clearStore(db, STORE_NAMES.SYNC_STATE),
    ])
  } finally {
    db.close()
  }
}
