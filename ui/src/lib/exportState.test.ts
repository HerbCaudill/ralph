import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { exportState, downloadStateExport, type ExportedState } from "./exportState"
import { PERSIST_NAME } from "@/store/persist"
import { PERSISTENCE_SCHEMA_VERSION } from "./persistence/types"

// Mock the eventDatabase module
vi.mock("./persistence/EventDatabase", () => ({
  eventDatabase: {
    init: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("exportState", () => {
  // Mock IndexedDB
  let mockDb: {
    transaction: ReturnType<typeof vi.fn>
    objectStoreNames: string[]
  }
  let mockStore: {
    getAll: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock IndexedDB store
    mockStore = {
      getAll: vi.fn().mockReturnValue({
        result: [],
        onerror: null,
        onsuccess: null,
      }),
    }

    // Setup mock database
    mockDb = {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue(mockStore),
      }),
      objectStoreNames: [
        "session_metadata",
        "sessions",
        "task_chat_metadata",
        "task_chat_sessions",
        "event_log_metadata",
        "event_logs",
        "sync_state",
      ],
    }

    // Mock indexedDB.open
    const mockOpenRequest = {
      result: mockDb,
      error: null,
      onerror: null as ((this: IDBRequest) => void) | null,
      onsuccess: null as ((this: IDBRequest) => void) | null,
    }

    vi.stubGlobal("indexedDB", {
      open: vi.fn().mockImplementation(() => {
        // Simulate async success
        setTimeout(() => {
          if (mockOpenRequest.onsuccess) {
            mockOpenRequest.onsuccess.call(mockOpenRequest as unknown as IDBRequest)
          }
        }, 0)
        return mockOpenRequest
      }),
    })

    // Mock localStorage
    const localStorageData: Record<string, string> = {}
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

  describe("exportState", () => {
    it("should return state with correct meta structure", async () => {
      // Setup mock store.getAll to simulate async completion
      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: [],
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

      const result = await exportState()

      expect(result.meta).toBeDefined()
      expect(result.meta.version).toBe(1)
      expect(result.meta.indexedDbSchemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION)
      expect(result.meta.localStorageKey).toBe(PERSIST_NAME)
      expect(result.meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("should include localStorage state when available", async () => {
      const mockState = { sidebarWidth: 300, theme: "dark" }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockState))

      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: [],
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

      const result = await exportState()

      expect(result.localStorage).toEqual(mockState)
    })

    it("should handle missing localStorage gracefully", async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: [],
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

      const result = await exportState()

      expect(result.localStorage).toBeNull()
    })

    it("should include all IndexedDB store names in the result", async () => {
      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: [],
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

      const result = await exportState()

      expect(result.indexedDb).toHaveProperty("session_metadata")
      expect(result.indexedDb).toHaveProperty("sessions")
      expect(result.indexedDb).toHaveProperty("task_chat_metadata")
      expect(result.indexedDb).toHaveProperty("task_chat_sessions")
      expect(result.indexedDb).toHaveProperty("event_log_metadata")
      expect(result.indexedDb).toHaveProperty("event_logs")
      expect(result.indexedDb).toHaveProperty("sync_state")
    })
  })

  describe("downloadStateExport", () => {
    it("should create and trigger a download link", async () => {
      // Mock URL APIs
      const mockUrl = "blob:http://localhost/test-blob"
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn().mockReturnValue(mockUrl),
        revokeObjectURL: vi.fn(),
      })

      // Mock document methods
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      }
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement)
      vi.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as unknown as Node)
      vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as unknown as Node)

      // Setup mock store
      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: [],
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

      await downloadStateExport("test-export.json")

      expect(document.createElement).toHaveBeenCalledWith("a")
      expect(mockLink.href).toBe(mockUrl)
      expect(mockLink.download).toBe("test-export.json")
      expect(mockLink.click).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl)
    })

    it("should generate timestamp-based filename when not provided", async () => {
      const mockUrl = "blob:http://localhost/test-blob"
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn().mockReturnValue(mockUrl),
        revokeObjectURL: vi.fn(),
      })

      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      }
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement)
      vi.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as unknown as Node)
      vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as unknown as Node)

      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: [],
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

      await downloadStateExport()

      expect(mockLink.download).toMatch(/^ralph-state-\d{4}-\d{2}-\d{2}T.*\.json$/)
    })
  })

  describe("ExportedState type", () => {
    it("should have the correct structure", () => {
      // Type check - this test verifies the interface is correct
      const validState: ExportedState = {
        meta: {
          exportedAt: "2025-01-01T00:00:00.000Z",
          version: 1,
          indexedDbSchemaVersion: 2,
          localStorageKey: "ralph-ui-store",
        },
        localStorage: { sidebarWidth: 300 },
        indexedDb: {
          session_metadata: [],
          sessions: [],
          task_chat_metadata: [],
          task_chat_sessions: [],
          event_log_metadata: [],
          event_logs: [],
          sync_state: [],
        },
      }

      expect(validState.meta.version).toBe(1)
      expect(validState.indexedDb.sessions).toEqual([])
    })
  })
})
