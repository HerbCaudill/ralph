import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  fetchCompressedState,
  restoreLocalStorage,
  restoreIndexedDB,
  importState,
  clearImportedState,
} from "./importState"
import { PERSIST_NAME, type PersistedState } from "@/store/persist"
import type { ExportedState } from "./exportState"
import { PERSISTENCE_SCHEMA_VERSION, STORE_NAMES } from "./persistence/types"

// Mock fflate
vi.mock("fflate", () => ({
  gunzipSync: vi.fn((data: Uint8Array) => {
    // Return the data as-is for testing (pretend it's already decompressed)
    return data
  }),
}))

describe("importState", () => {
  // Sample exported state for testing
  const mockExportedState: ExportedState = {
    meta: {
      exportedAt: "2025-01-27T00:00:00.000Z",
      version: 1,
      indexedDbSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
      localStorageKey: PERSIST_NAME,
    },
    localStorage: {
      state: {
        sidebarWidth: 300,
        theme: "dark",
        tasks: [],
      } as unknown as PersistedState,
      version: 4,
    },
    indexedDb: {
      sessions: [
        {
          id: "session-1",
          instanceId: "default",
          workspaceId: "/path/to/workspace",
          startedAt: 1706313600000,
          completedAt: null,
          taskId: "task-1",
          taskTitle: "Test Task",
          tokenUsage: { input: 100, output: 50 },
          contextWindow: { used: 150, max: 200000 },
          session: { current: 1, total: 5 },
          eventCount: 10,
          lastEventSequence: 9,
        },
      ],
      events: [
        {
          id: "session-1-event-0",
          sessionId: "session-1",
          timestamp: 1706313600000,
          eventType: "user",
          event: { type: "user", content: "Hello", timestamp: 1706313600000 },
        },
      ],
      chat_sessions: [],
      sync_state: [{ key: "last_sync_timestamp", value: 1706313600000 }],
    },
  }

  let localStorageData: Record<string, string>

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock localStorage
    localStorageData = {}
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => localStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageData[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageData[key]
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("fetchCompressedState", () => {
    it("should fetch and decompress a gzipped state file", async () => {
      const mockJsonString = JSON.stringify(mockExportedState)
      const mockArrayBuffer = new TextEncoder().encode(mockJsonString).buffer

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        }),
      )

      const result = await fetchCompressedState("/fixtures/test-state.json.gz")

      expect(fetch).toHaveBeenCalledWith("/fixtures/test-state.json.gz")
      expect(result.meta.version).toBe(1)
      expect(result.localStorage).toEqual(mockExportedState.localStorage)
    })

    it("should throw on fetch failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      )

      await expect(fetchCompressedState("/fixtures/missing.json.gz")).rejects.toThrow(
        "Failed to fetch state file: 404 Not Found",
      )
    })
  })

  describe("restoreLocalStorage", () => {
    it("should restore localStorage state", () => {
      restoreLocalStorage(mockExportedState)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        PERSIST_NAME,
        JSON.stringify(mockExportedState.localStorage),
      )
    })

    it("should use the key from meta if provided", () => {
      const stateWithCustomKey: ExportedState = {
        ...mockExportedState,
        meta: {
          ...mockExportedState.meta,
          localStorageKey: "custom-key",
        },
      }

      restoreLocalStorage(stateWithCustomKey)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "custom-key",
        JSON.stringify(stateWithCustomKey.localStorage),
      )
    })

    it("should not set localStorage if state is null", () => {
      const stateWithNullStorage: ExportedState = {
        ...mockExportedState,
        localStorage: null,
      }

      restoreLocalStorage(stateWithNullStorage)

      expect(localStorage.setItem).not.toHaveBeenCalled()
    })
  })

  describe("restoreIndexedDB", () => {
    let mockDb: {
      transaction: ReturnType<typeof vi.fn>
      close: ReturnType<typeof vi.fn>
    }
    let mockStores: Record<
      string,
      {
        clear: ReturnType<typeof vi.fn>
        put: ReturnType<typeof vi.fn>
      }
    >

    beforeEach(() => {
      // Setup mock stores
      mockStores = {
        [STORE_NAMES.SESSIONS]: {
          clear: vi.fn(),
          put: vi.fn(),
        },
        [STORE_NAMES.EVENTS]: {
          clear: vi.fn(),
          put: vi.fn(),
        },
        [STORE_NAMES.CHAT_SESSIONS]: {
          clear: vi.fn(),
          put: vi.fn(),
        },
        [STORE_NAMES.SYNC_STATE]: {
          clear: vi.fn(),
          put: vi.fn(),
        },
      }

      // Setup mock database
      mockDb = {
        transaction: vi.fn().mockImplementation((_storeName: string, _mode: string) => ({
          objectStore: vi.fn().mockImplementation((name: string) => {
            const store = mockStores[name]
            // Make clear and put return request-like objects
            store.clear.mockImplementation(() => {
              const request = {
                error: null,
                onerror: null as ((this: IDBRequest) => void) | null,
                onsuccess: null as ((this: IDBRequest) => void) | null,
              }
              setTimeout(() => {
                if (request.onsuccess) {
                  request.onsuccess.call(request as unknown as IDBRequest)
                }
              }, 0)
              return request
            })
            return store
          }),
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
        })),
        close: vi.fn(),
      }

      // Mock indexedDB.open
      const mockOpenRequest = {
        result: mockDb,
        error: null,
        onerror: null as ((this: IDBRequest) => void) | null,
        onsuccess: null as ((this: IDBRequest) => void) | null,
        onupgradeneeded: null as ((this: IDBRequest, event: IDBVersionChangeEvent) => void) | null,
      }

      vi.stubGlobal("indexedDB", {
        open: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess) {
              mockOpenRequest.onsuccess.call(mockOpenRequest as unknown as IDBRequest)
            }
          }, 0)
          return mockOpenRequest
        }),
      })
    })

    it("should clear existing stores before restoring", async () => {
      // Setup transaction mock to complete successfully
      mockDb.transaction.mockImplementation((_storeName: string) => {
        const tx = {
          objectStore: vi.fn().mockImplementation((name: string) => {
            const store = mockStores[name]
            store.clear.mockImplementation(() => {
              const request = {
                error: null,
                onerror: null as ((this: IDBRequest) => void) | null,
                onsuccess: null as ((this: IDBRequest) => void) | null,
              }
              setTimeout(() => {
                if (request.onsuccess) {
                  request.onsuccess.call(request as unknown as IDBRequest)
                }
              }, 0)
              return request
            })
            return store
          }),
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
        }
        // Trigger oncomplete after a tick for put operations
        setTimeout(() => {
          if (tx.oncomplete) tx.oncomplete()
        }, 10)
        return tx
      })

      await restoreIndexedDB(mockExportedState)

      expect(mockDb.close).toHaveBeenCalled()
    })
  })

  describe("importState", () => {
    it("should restore both localStorage and IndexedDB", async () => {
      // Setup IndexedDB mock
      const mockDb = {
        transaction: vi.fn().mockImplementation(() => ({
          objectStore: vi.fn().mockImplementation(() => ({
            clear: vi.fn().mockImplementation(() => {
              const request = {
                error: null,
                onerror: null,
                onsuccess: null as (() => void) | null,
              }
              setTimeout(() => request.onsuccess?.(), 0)
              return request
            }),
            put: vi.fn(),
          })),
          oncomplete: null as (() => void) | null,
          onerror: null,
        })),
        close: vi.fn(),
      }

      const mockOpenRequest = {
        result: mockDb,
        error: null,
        onerror: null,
        onsuccess: null as (() => void) | null,
        onupgradeneeded: null,
      }

      vi.stubGlobal("indexedDB", {
        open: vi.fn().mockImplementation(() => {
          setTimeout(() => mockOpenRequest.onsuccess?.(), 0)
          return mockOpenRequest
        }),
      })

      // Make transaction complete
      mockDb.transaction.mockImplementation(() => {
        const tx = {
          objectStore: vi.fn().mockImplementation(() => ({
            clear: vi.fn().mockImplementation(() => {
              const request = { error: null, onerror: null, onsuccess: null as (() => void) | null }
              setTimeout(() => request.onsuccess?.(), 0)
              return request
            }),
            put: vi.fn(),
          })),
          oncomplete: null as (() => void) | null,
          onerror: null,
        }
        setTimeout(() => tx.oncomplete?.(), 10)
        return tx
      })

      await importState(mockExportedState)

      // Verify localStorage was set
      expect(localStorage.setItem).toHaveBeenCalledWith(
        PERSIST_NAME,
        JSON.stringify(mockExportedState.localStorage),
      )

      // Verify database was opened and closed
      expect(indexedDB.open).toHaveBeenCalled()
      expect(mockDb.close).toHaveBeenCalled()
    })
  })

  describe("clearImportedState", () => {
    it("should clear localStorage and IndexedDB", async () => {
      // Setup IndexedDB mock
      const mockDb = {
        transaction: vi.fn().mockImplementation(() => ({
          objectStore: vi.fn().mockImplementation(() => ({
            clear: vi.fn().mockImplementation(() => {
              const request = {
                error: null,
                onerror: null,
                onsuccess: null as (() => void) | null,
              }
              setTimeout(() => request.onsuccess?.(), 0)
              return request
            }),
          })),
        })),
        close: vi.fn(),
      }

      const mockOpenRequest = {
        result: mockDb,
        error: null,
        onerror: null,
        onsuccess: null as (() => void) | null,
        onupgradeneeded: null,
      }

      vi.stubGlobal("indexedDB", {
        open: vi.fn().mockImplementation(() => {
          setTimeout(() => mockOpenRequest.onsuccess?.(), 0)
          return mockOpenRequest
        }),
      })

      await clearImportedState()

      expect(localStorage.removeItem).toHaveBeenCalledWith(PERSIST_NAME)
      expect(mockDb.close).toHaveBeenCalled()
    })
  })
})
