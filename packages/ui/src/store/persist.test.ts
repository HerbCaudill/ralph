import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { RalphInstance, ChatEvent } from "@/types"
import type { AppState, AppActions } from "./index"
import {
  PERSIST_VERSION,
  PERSIST_NAME,
  serializeInstances,
  deserializeInstances,
  partialize,
  rawStorage,
  storage,
  onRehydrateStorage,
  persistConfig,
  migrate,
  type SerializedRalphInstance,
  type PersistedState,
} from "./persist"
import {
  THEME_STORAGE_KEY,
  VSCODE_THEME_STORAGE_KEY,
  LAST_DARK_THEME_STORAGE_KEY,
  LAST_LIGHT_THEME_STORAGE_KEY,
} from "@/constants"
import { DEFAULT_CONTEXT_WINDOW_MAX, DEFAULT_INSTANCE_ID } from "./index"

// Helper to create a mock RalphInstance
function createMockInstance(overrides: Partial<RalphInstance> = {}): RalphInstance {
  return {
    id: "test-instance",
    name: "Test Instance",
    agentName: "Ralph",
    status: "stopped",
    events: [],
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
    session: { current: 0, total: 0 },
    worktreePath: null,
    branch: null,
    currentTaskId: null,
    createdAt: Date.now(),
    runStartedAt: null,
    mergeConflict: null,
    ...overrides,
  }
}

// Helper to create a mock ChatEvent
function createMockEvent(overrides: Partial<ChatEvent> = {}): ChatEvent {
  return {
    type: "assistant_text",
    timestamp: Date.now(),
    content: "test content",
    ...overrides,
  }
}

/**
 * Helper to create a minimal mock AppState for testing.
 * Returns AppState & AppActions for type compatibility with persistConfig.merge.
 * Actions are cast since we only test state merging, not action behavior.
 */
function createMockAppState(overrides: Partial<AppState> = {}): AppState & AppActions {
  const defaultInstance = createMockInstance({ id: DEFAULT_INSTANCE_ID, name: "Main" })
  const instances = overrides.instances ?? new Map([[DEFAULT_INSTANCE_ID, defaultInstance]])

  return {
    instances,
    activeInstanceId: DEFAULT_INSTANCE_ID,
    workspace: null,
    branch: null,
    issuePrefix: null,
    connectionStatus: "disconnected",
    accentColor: null,
    sidebarWidth: 320,
    theme: "system",
    vscodeThemeId: null,
    lastDarkThemeId: null,
    lastLightThemeId: null,
    taskChatOpen: true,
    taskChatWidth: 400,
    taskChatMessages: [],
    taskChatLoading: false,
    currentTaskChatSessionId: null,
    showToolOutput: false,
    isSearchVisible: false,
    hotkeysDialogOpen: false,
    wasRunningBeforeDisconnect: false,
    hasInitialSync: false,
    persistenceError: null,
    taskChatEvents: [],
    taskChatInputDraft: "",
    ...overrides,
  } as AppState & AppActions
}

describe("persist", () => {
  describe("constants", () => {
    it("exports PERSIST_VERSION", () => {
      expect(PERSIST_VERSION).toBe(9)
    })

    it("exports PERSIST_NAME", () => {
      expect(PERSIST_NAME).toBe("ralph-ui-store")
    })
  })

  describe("serializeInstances", () => {
    it("converts Map to array", () => {
      const instances = new Map<string, RalphInstance>([
        ["instance-1", createMockInstance({ id: "instance-1", name: "Instance 1" })],
        ["instance-2", createMockInstance({ id: "instance-2", name: "Instance 2" })],
      ])

      const result = serializeInstances(instances, "instance-1")

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
    })

    it("does not include events (they are stored in IndexedDB)", () => {
      const events: ChatEvent[] = [
        createMockEvent({ content: "event 1" }),
        createMockEvent({ content: "event 2" }),
      ]

      const instances = new Map<string, RalphInstance>([
        ["active", createMockInstance({ id: "active", events })],
        ["inactive", createMockInstance({ id: "inactive", events })],
      ])

      const result = serializeInstances(instances, "active")

      // Events should NOT be present in serialized output
      const activeResult = result.find(i => i.id === "active")
      const inactiveResult = result.find(i => i.id === "inactive")

      expect(activeResult).not.toHaveProperty("events")
      expect(inactiveResult).not.toHaveProperty("events")
    })

    it("preserves all instance properties", () => {
      const instance = createMockInstance({
        id: "test",
        name: "Test",
        agentName: "Ralph-1",
        status: "running",
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 5000, max: 200000 },
        session: { current: 2, total: 5 },
        worktreePath: "/path/to/worktree",
        branch: "feature-branch",
        currentTaskId: "task-123",
        createdAt: 1234567890,
        runStartedAt: 1234567900,
        mergeConflict: {
          files: ["file1.ts", "file2.ts"],
          sourceBranch: "main",
          timestamp: 1234567950,
        },
      })

      const instances = new Map([["test", instance]])
      const result = serializeInstances(instances, "test")

      expect(result[0]).toMatchObject({
        id: "test",
        name: "Test",
        agentName: "Ralph-1",
        status: "running",
        tokenUsage: { input: 100, output: 50 },
        contextWindow: { used: 5000, max: 200000 },
        session: { current: 2, total: 5 },
        worktreePath: "/path/to/worktree",
        branch: "feature-branch",
        currentTaskId: "task-123",
        createdAt: 1234567890,
        runStartedAt: 1234567900,
        mergeConflict: {
          files: ["file1.ts", "file2.ts"],
          sourceBranch: "main",
          timestamp: 1234567950,
        },
      })
    })

    it("handles empty instances Map", () => {
      const instances = new Map<string, RalphInstance>()
      const result = serializeInstances(instances, "nonexistent")

      expect(result).toEqual([])
    })
  })

  describe("deserializeInstances", () => {
    it("converts array back to Map", () => {
      const serialized: SerializedRalphInstance[] = [
        {
          id: "instance-1",
          name: "Instance 1",
          agentName: "Ralph",
          status: "stopped",
          tokenUsage: { input: 0, output: 0 },
          contextWindow: { used: 0, max: 200000 },
          session: { current: 0, total: 0 },
          worktreePath: null,
          branch: null,
          currentTaskId: null,
          createdAt: 1234567890,
          runStartedAt: null,
          mergeConflict: null,
        },
      ]

      const result = deserializeInstances(serialized)

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(1)
      expect(result.has("instance-1")).toBe(true)
    })

    it("restores RalphInstance with proper structure (events always empty)", () => {
      const serialized: SerializedRalphInstance[] = [
        {
          id: "test",
          name: "Test Instance",
          agentName: "Ralph-1",
          status: "running",
          tokenUsage: { input: 100, output: 50 },
          contextWindow: { used: 5000, max: 200000 },
          session: { current: 2, total: 5 },
          worktreePath: "/path/to/worktree",
          branch: "feature-branch",
          currentTaskId: "task-123",
          createdAt: 1234567890,
          runStartedAt: 1234567900,
          mergeConflict: {
            files: ["file1.ts"],
            sourceBranch: "main",
            timestamp: 1234567950,
          },
        },
      ]

      const result = deserializeInstances(serialized)
      const instance = result.get("test")

      expect(instance).toBeDefined()
      expect(instance?.id).toBe("test")
      expect(instance?.name).toBe("Test Instance")
      expect(instance?.agentName).toBe("Ralph-1")
      expect(instance?.status).toBe("running")
      // Events are always empty - they will be restored from IndexedDB
      expect(instance?.events).toEqual([])
      expect(instance?.tokenUsage).toEqual({ input: 100, output: 50 })
      expect(instance?.contextWindow).toEqual({ used: 5000, max: 200000 })
      expect(instance?.session).toEqual({ current: 2, total: 5 })
      expect(instance?.worktreePath).toBe("/path/to/worktree")
      expect(instance?.branch).toBe("feature-branch")
      expect(instance?.currentTaskId).toBe("task-123")
      expect(instance?.createdAt).toBe(1234567890)
      expect(instance?.runStartedAt).toBe(1234567900)
      expect(instance?.mergeConflict).toEqual({
        files: ["file1.ts"],
        sourceBranch: "main",
        timestamp: 1234567950,
      })
    })

    it("provides defaults for missing optional fields", () => {
      const serialized: SerializedRalphInstance[] = [
        {
          id: "minimal",
          name: "Minimal",
          agentName: "Ralph",
          status: "stopped",
          tokenUsage: undefined as any,
          contextWindow: undefined as any,
          session: undefined as any,
          worktreePath: null,
          branch: null,
          currentTaskId: null,
          createdAt: undefined as any,
          runStartedAt: null,
          mergeConflict: null,
        },
      ]

      const result = deserializeInstances(serialized)
      const instance = result.get("minimal")

      expect(instance?.events).toEqual([])
      expect(instance?.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(instance?.contextWindow).toEqual({ used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX })
      expect(instance?.session).toEqual({ current: 0, total: 0 })
      expect(instance?.createdAt).toBeDefined()
    })

    it("handles empty array", () => {
      const result = deserializeInstances([])
      expect(result.size).toBe(0)
    })

    it("handles multiple instances", () => {
      const serialized: SerializedRalphInstance[] = [
        {
          id: "one",
          name: "One",
          agentName: "Ralph",
          status: "stopped",
          tokenUsage: { input: 0, output: 0 },
          contextWindow: { used: 0, max: 200000 },
          session: { current: 0, total: 0 },
          worktreePath: null,
          branch: null,
          currentTaskId: null,
          createdAt: 1234567890,
          runStartedAt: null,
          mergeConflict: null,
        },
        {
          id: "two",
          name: "Two",
          agentName: "Ralph-2",
          status: "running",
          tokenUsage: { input: 10, output: 5 },
          contextWindow: { used: 100, max: 200000 },
          session: { current: 1, total: 3 },
          worktreePath: "/worktree",
          branch: "feature",
          currentTaskId: "task-1",
          createdAt: 1234567891,
          runStartedAt: 1234567895,
          mergeConflict: null,
        },
      ]

      const result = deserializeInstances(serialized)

      expect(result.size).toBe(2)
      expect(result.get("one")?.name).toBe("One")
      expect(result.get("two")?.name).toBe("Two")
    })
  })

  describe("partialize", () => {
    it("returns only persisted fields", () => {
      const state = createMockAppState({
        sidebarWidth: 400,
        taskChatOpen: false,
        taskChatWidth: 500,
        showToolOutput: true,
        theme: "dark",
        isSearchVisible: true,
        workspace: "/path/to/workspace",
        branch: "main",
        issuePrefix: "TEST",
        accentColor: "#ff0000",
      })

      const result = partialize(state)

      expect(result).toEqual({
        sidebarWidth: 400,
        taskChatOpen: false,
        taskChatWidth: 500,
        showToolOutput: true,
        theme: "dark",
        vscodeThemeId: null,
        lastDarkThemeId: null,
        lastLightThemeId: null,
        currentTaskChatSessionId: null,
        isSearchVisible: true,
        taskChatInputDraft: "",
        workspace: "/path/to/workspace",
        branch: "main",
        issuePrefix: "TEST",
        accentColor: "#ff0000",
        instances: expect.any(Array),
        activeInstanceId: DEFAULT_INSTANCE_ID,
      })
    })

    it("excludes runtime-only fields", () => {
      // Create an instance with runtime fields set
      const runningInstance = createMockInstance({
        id: DEFAULT_INSTANCE_ID,
        name: "Main",
        status: "running",
        runStartedAt: Date.now(),
      })
      const instances = new Map([[DEFAULT_INSTANCE_ID, runningInstance]])

      const state = createMockAppState({
        instances,
        connectionStatus: "connected",
        taskChatMessages: [{ id: "1", role: "user", content: "hi", timestamp: 0 }],
        taskChatLoading: true,
        taskChatEvents: [createMockEvent()],
        hotkeysDialogOpen: true,
        wasRunningBeforeDisconnect: true,
        disconnectedAt: Date.now(),
        hasInitialSync: true,
        persistenceError: { message: "test error", failedCount: 3 },
      })

      const result = partialize(state)

      // These should NOT be in the result (they are runtime-only)
      expect(result).not.toHaveProperty("connectionStatus")
      expect(result).not.toHaveProperty("taskChatMessages")
      expect(result).not.toHaveProperty("taskChatLoading")
      expect(result).not.toHaveProperty("taskChatEvents")
      expect(result).not.toHaveProperty("hotkeysDialogOpen")
      expect(result).not.toHaveProperty("wasRunningBeforeDisconnect")
      expect(result).not.toHaveProperty("disconnectedAt")
      expect(result).not.toHaveProperty("hasInitialSync")
      expect(result).not.toHaveProperty("persistenceError")

      // Note: ralphStatus and runStartedAt are per-instance fields stored within RalphInstance,
      // not on AppState directly. The serialized instances should also exclude these runtime fields.
    })

    it("serializes instances correctly (without events)", () => {
      const events = [createMockEvent()]
      const instance = createMockInstance({
        id: DEFAULT_INSTANCE_ID,
        name: "Main",
        events,
      })
      const instances = new Map([[DEFAULT_INSTANCE_ID, instance]])

      const state = createMockAppState({ instances })
      const result = partialize(state)

      expect(result.instances).toHaveLength(1)
      expect(result.instances[0].id).toBe(DEFAULT_INSTANCE_ID)
      // Events are NOT included in serialization - they are stored in IndexedDB
      expect(result.instances[0]).not.toHaveProperty("events")
    })
  })

  describe("rawStorage", () => {
    const originalLocalStorage = global.localStorage

    beforeEach(() => {
      // Create a mock localStorage
      const store: Record<string, string> = {}
      global.localStorage = {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key]
        }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
    })

    afterEach(() => {
      global.localStorage = originalLocalStorage
    })

    it("getItem returns stored value", () => {
      localStorage.setItem("test-key", "test-value")
      expect(rawStorage.getItem("test-key")).toBe("test-value")
    })

    it("getItem returns null for missing key", () => {
      expect(rawStorage.getItem("nonexistent")).toBeNull()
    })

    it("setItem stores value", () => {
      rawStorage.setItem("test-key", "test-value")
      expect(localStorage.setItem).toHaveBeenCalledWith("test-key", "test-value")
    })

    it("removeItem removes value", () => {
      rawStorage.removeItem("test-key")
      expect(localStorage.removeItem).toHaveBeenCalledWith("test-key")
    })

    it("handles localStorage errors gracefully", () => {
      global.localStorage.getItem = vi.fn(() => {
        throw new Error("localStorage disabled")
      })
      global.localStorage.setItem = vi.fn(() => {
        throw new Error("localStorage disabled")
      })
      global.localStorage.removeItem = vi.fn(() => {
        throw new Error("localStorage disabled")
      })

      // Should not throw
      expect(() => rawStorage.getItem("key")).not.toThrow()
      expect(() => rawStorage.setItem("key", "value")).not.toThrow()
      expect(() => rawStorage.removeItem("key")).not.toThrow()

      expect(rawStorage.getItem("key")).toBeNull()
    })
  })

  describe("onRehydrateStorage", () => {
    it("returns a callback function", () => {
      const state = createMockAppState()
      const callback = onRehydrateStorage(state)

      expect(typeof callback).toBe("function")
    })

    it("handles successful rehydration", () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {})

      const state = createMockAppState()
      const callback = onRehydrateStorage(state)

      // Should not throw
      expect(() => callback(state)).not.toThrow()

      consoleSpy.mockRestore()
    })

    it("handles rehydration error", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const state = createMockAppState()
      const callback = onRehydrateStorage(state)

      // Should not throw, but should warn
      callback(undefined, new Error("Rehydration failed"))

      expect(consoleSpy).toHaveBeenCalledWith(
        "[persist] Failed to rehydrate state:",
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it("handles undefined state gracefully", () => {
      const callback = onRehydrateStorage(undefined)

      // Should not throw
      expect(() => callback(undefined)).not.toThrow()
    })
  })

  describe("persistConfig", () => {
    it("has correct name", () => {
      expect(persistConfig.name).toBe(PERSIST_NAME)
    })

    it("has correct version", () => {
      expect(persistConfig.version).toBe(9)
    })

    it("has storage adapter", () => {
      expect(persistConfig.storage).toBe(storage)
    })

    it("has partialize function", () => {
      expect(persistConfig.partialize).toBe(partialize)
    })

    it("has onRehydrateStorage function", () => {
      expect(persistConfig.onRehydrateStorage).toBe(onRehydrateStorage)
    })

    describe("merge", () => {
      it("merges persisted state with current state", () => {
        const currentState = createMockAppState()
        const persistedState: PersistedState = {
          sidebarWidth: 500,
          taskChatOpen: false,
          taskChatWidth: 600,
          showToolOutput: true,
          theme: "dark",
          vscodeThemeId: null,
          lastDarkThemeId: null,
          lastLightThemeId: null,
          currentTaskChatSessionId: null,
          isSearchVisible: true,
          taskChatInputDraft: "",
          workspace: "/new/workspace",
          branch: "develop",
          issuePrefix: "DEV",
          accentColor: "#00ff00",
          instances: [
            {
              id: DEFAULT_INSTANCE_ID,
              name: "Main",
              agentName: "Ralph",
              status: "stopped",
              tokenUsage: { input: 0, output: 0 },
              contextWindow: { used: 0, max: 200000 },
              session: { current: 0, total: 0 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              createdAt: 1234567890,
              runStartedAt: null,
              mergeConflict: null,
            },
          ],
          activeInstanceId: DEFAULT_INSTANCE_ID,
        }

        const result = persistConfig.merge!(persistedState, currentState)

        expect(result.sidebarWidth).toBe(500)
        expect(result.taskChatOpen).toBe(false)
        expect(result.theme).toBe("dark")
        expect(result.workspace).toBe("/new/workspace")
        expect(result.instances).toBeInstanceOf(Map)
      })

      it("returns current state when persisted state is undefined", () => {
        const currentState = createMockAppState()
        const result = persistConfig.merge!(undefined, currentState)

        expect(result).toBe(currentState)
      })

      it("deserializes instances array to Map", () => {
        const currentState = createMockAppState()
        const persistedState: PersistedState = {
          ...partialize(currentState),
          instances: [
            {
              id: "instance-a",
              name: "Instance A",
              agentName: "Ralph",
              status: "stopped",
              tokenUsage: { input: 0, output: 0 },
              contextWindow: { used: 0, max: 200000 },
              session: { current: 0, total: 0 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              createdAt: 1234567890,
              runStartedAt: null,
              mergeConflict: null,
            },
            {
              id: "instance-b",
              name: "Instance B",
              agentName: "Ralph-2",
              status: "running",
              tokenUsage: { input: 10, output: 5 },
              contextWindow: { used: 100, max: 200000 },
              session: { current: 1, total: 2 },
              worktreePath: "/worktree",
              branch: "feature",
              currentTaskId: "task-1",
              createdAt: 1234567891,
              runStartedAt: 1234567900,
              mergeConflict: null,
            },
          ],
          activeInstanceId: "instance-b",
        }

        const result = persistConfig.merge!(persistedState, currentState)

        expect(result.instances).toBeInstanceOf(Map)
        expect(result.instances.size).toBe(2)
        expect(result.instances.get("instance-a")?.name).toBe("Instance A")
        expect(result.instances.get("instance-b")?.name).toBe("Instance B")
      })

      it("validates activeInstanceId exists in instances", () => {
        const currentState = createMockAppState()
        const persistedState: PersistedState = {
          ...partialize(currentState),
          instances: [
            {
              id: "only-instance",
              name: "Only",
              agentName: "Ralph",
              status: "stopped",
              tokenUsage: { input: 0, output: 0 },
              contextWindow: { used: 0, max: 200000 },
              session: { current: 0, total: 0 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              createdAt: 1234567890,
              runStartedAt: null,
              mergeConflict: null,
            },
          ],
          activeInstanceId: "nonexistent", // This doesn't exist in instances
        }

        const result = persistConfig.merge!(persistedState, currentState)

        // Should fall back to currentState.activeInstanceId
        expect(result.activeInstanceId).toBe(currentState.activeInstanceId)
      })

      it("restores instances from persisted state", () => {
        const currentState = createMockAppState()
        const persistedState: PersistedState = {
          ...partialize(currentState),
          instances: [
            {
              id: "active",
              name: "Active",
              agentName: "Ralph",
              status: "running",
              tokenUsage: { input: 100, output: 50 },
              contextWindow: { used: 5000, max: 200000 },
              session: { current: 2, total: 5 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              createdAt: 1234567890,
              runStartedAt: 1234567900,
              mergeConflict: null,
            },
          ],
          activeInstanceId: "active",
        }

        const result = persistConfig.merge!(persistedState, currentState)

        // Instances should be restored from persisted state
        const activeInstance = result.instances.get("active")
        expect(activeInstance).toBeDefined()
        expect(activeInstance?.status).toBe("running")
        expect(activeInstance?.tokenUsage).toEqual({ input: 100, output: 50 })
        expect(activeInstance?.contextWindow).toEqual({ used: 5000, max: 200000 })
        expect(activeInstance?.session).toEqual({ current: 2, total: 5 })
        expect(activeInstance?.runStartedAt).toBe(1234567900)
        // Events are NOT restored from localStorage - they come from IndexedDB
        expect(activeInstance?.events).toEqual([])
      })

      it("uses current state instances when persisted instances is empty", () => {
        const currentState = createMockAppState()
        const persistedState: PersistedState = {
          ...partialize(currentState),
          instances: [],
        }

        const result = persistConfig.merge!(persistedState, currentState)

        expect(result.instances).toBe(currentState.instances)
      })
    })
  })

  describe("round-trip serialization", () => {
    it("can serialize and deserialize instances (events always empty)", () => {
      const events = [
        createMockEvent({ content: "event 1" }),
        createMockEvent({ content: "event 2" }),
      ]

      const instances = new Map<string, RalphInstance>([
        [
          "active",
          createMockInstance({
            id: "active",
            name: "Active Instance",
            agentName: "Ralph-1",
            status: "running",
            events,
            tokenUsage: { input: 100, output: 50 },
            contextWindow: { used: 5000, max: 200000 },
            session: { current: 2, total: 5 },
            worktreePath: "/worktree/active",
            branch: "feature-active",
            currentTaskId: "task-active",
            createdAt: 1234567890,
            runStartedAt: 1234567900,
            mergeConflict: {
              files: ["file1.ts", "file2.ts"],
              sourceBranch: "main",
              timestamp: 1234567950,
            },
          }),
        ],
        [
          "inactive",
          createMockInstance({
            id: "inactive",
            name: "Inactive Instance",
            agentName: "Ralph-2",
            status: "stopped",
            events: [],
            tokenUsage: { input: 10, output: 5 },
            contextWindow: { used: 100, max: 200000 },
            session: { current: 1, total: 2 },
            worktreePath: "/worktree/inactive",
            branch: "feature-inactive",
            currentTaskId: null,
            createdAt: 1234567891,
            runStartedAt: null,
            mergeConflict: null,
          }),
        ],
      ])

      const serialized = serializeInstances(instances, "active")
      const deserialized = deserializeInstances(serialized)

      // Instance properties should be preserved (except events)
      const activeOriginal = instances.get("active")!
      const activeRestored = deserialized.get("active")!

      expect(activeRestored.id).toBe(activeOriginal.id)
      expect(activeRestored.name).toBe(activeOriginal.name)
      expect(activeRestored.agentName).toBe(activeOriginal.agentName)
      expect(activeRestored.status).toBe(activeOriginal.status)
      // Events are NOT preserved - they will be restored from IndexedDB
      expect(activeRestored.events).toEqual([])
      expect(activeRestored.tokenUsage).toEqual(activeOriginal.tokenUsage)
      expect(activeRestored.contextWindow).toEqual(activeOriginal.contextWindow)
      expect(activeRestored.session).toEqual(activeOriginal.session)
      expect(activeRestored.worktreePath).toBe(activeOriginal.worktreePath)
      expect(activeRestored.branch).toBe(activeOriginal.branch)
      expect(activeRestored.currentTaskId).toBe(activeOriginal.currentTaskId)
      expect(activeRestored.createdAt).toBe(activeOriginal.createdAt)
      expect(activeRestored.runStartedAt).toBe(activeOriginal.runStartedAt)
      expect(activeRestored.mergeConflict).toEqual(activeOriginal.mergeConflict)

      // Inactive instance should also have empty events
      const inactiveRestored = deserialized.get("inactive")!
      expect(inactiveRestored.events).toEqual([])
    })
  })

  describe("migrate", () => {
    const originalLocalStorage = global.localStorage
    let mockStore: Record<string, string>

    beforeEach(() => {
      mockStore = {}
      global.localStorage = {
        getItem: vi.fn((key: string) => mockStore[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStore[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStore[key]
        }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
    })

    afterEach(() => {
      global.localStorage = originalLocalStorage
    })

    it("returns state unchanged when version >= 9", () => {
      const state: PersistedState = {
        sidebarWidth: 25,
        taskChatOpen: true,
        taskChatWidth: 30,
        showToolOutput: false,
        theme: "system",
        vscodeThemeId: "my-theme",
        lastDarkThemeId: "dark-theme",
        lastLightThemeId: "light-theme",
        currentTaskChatSessionId: null,
        isSearchVisible: false,
        taskChatInputDraft: "chat draft",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      }

      const result = migrate(state, 9)

      expect(result).toEqual(state)
    })

    it("migrates from v3 by loading legacy theme localStorage keys", () => {
      mockStore[THEME_STORAGE_KEY] = "dark"
      mockStore[VSCODE_THEME_STORAGE_KEY] = "my-vscode-theme"
      mockStore[LAST_DARK_THEME_STORAGE_KEY] = "my-dark-theme"
      mockStore[LAST_LIGHT_THEME_STORAGE_KEY] = "my-light-theme"

      const state = {
        sidebarWidth: 400,
        taskChatOpen: true,
        taskChatWidth: 400,
        showToolOutput: false,
        theme: "system",
        currentTaskChatSessionId: null,
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      } as unknown as PersistedState

      const result = migrate(state, 3)

      expect(result.theme).toBe("dark")
      expect(result.vscodeThemeId).toBe("my-vscode-theme")
      expect(result.lastDarkThemeId).toBe("my-dark-theme")
      expect(result.lastLightThemeId).toBe("my-light-theme")
      expect(localStorage.removeItem).toHaveBeenCalledWith(THEME_STORAGE_KEY)
      expect(localStorage.removeItem).toHaveBeenCalledWith(VSCODE_THEME_STORAGE_KEY)
      expect(localStorage.removeItem).toHaveBeenCalledWith(LAST_DARK_THEME_STORAGE_KEY)
      expect(localStorage.removeItem).toHaveBeenCalledWith(LAST_LIGHT_THEME_STORAGE_KEY)
    })

    it("uses null defaults when no legacy theme localStorage data exists", () => {
      const state = {
        sidebarWidth: 400,
        taskChatOpen: true,
        taskChatWidth: 400,
        showToolOutput: false,
        theme: "system",
        currentTaskChatSessionId: null,
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      } as unknown as PersistedState

      const result = migrate(state, 3)

      expect(result.theme).toBe("system")
      expect(result.vscodeThemeId).toBeNull()
      expect(result.lastDarkThemeId).toBeNull()
      expect(result.lastLightThemeId).toBeNull()
    })

    it("migrates from v5 to v6 by converting pixel widths to percentages", () => {
      Object.defineProperty(window, "innerWidth", {
        value: 1600,
        writable: true,
        configurable: true,
      })

      const state = {
        sidebarWidth: 320,
        taskChatOpen: true,
        taskChatWidth: 400,
        showToolOutput: false,
        theme: "system",
        vscodeThemeId: null,
        lastDarkThemeId: null,
        lastLightThemeId: null,
        currentTaskChatSessionId: null,
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      } as unknown as PersistedState

      const result = migrate(state, 5)

      expect(result.sidebarWidth).toBe(20)
      expect(result.taskChatWidth).toBe(25)
    })

    it("does not convert widths that are already percentages (< 100)", () => {
      const state = {
        sidebarWidth: 25,
        taskChatOpen: true,
        taskChatWidth: 30,
        showToolOutput: false,
        theme: "system",
        vscodeThemeId: null,
        lastDarkThemeId: null,
        lastLightThemeId: null,
        currentTaskChatSessionId: null,
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      } as unknown as PersistedState

      const result = migrate(state, 5)

      expect(result.sidebarWidth).toBe(25)
      expect(result.taskChatWidth).toBe(30)
    })

    it("removes viewingSessionIndex when version < 7", () => {
      const state = {
        sidebarWidth: 25,
        taskChatOpen: true,
        taskChatWidth: 30,
        showToolOutput: false,
        theme: "system",
        currentTaskChatSessionId: null,
        viewingSessionIndex: 2,
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      } as unknown as PersistedState

      const result = migrate(state, 6)

      expect(result).not.toHaveProperty("viewingSessionIndex")
      expect(result).not.toHaveProperty("viewingSessionId")
    })

    it("removes viewingSessionId when version < 8", () => {
      const state = {
        sidebarWidth: 25,
        taskChatOpen: true,
        taskChatWidth: 30,
        showToolOutput: false,
        theme: "system",
        currentTaskChatSessionId: null,
        viewingSessionId: "some-session-id",
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
      } as unknown as PersistedState

      const result = migrate(state, 7)

      expect(result).not.toHaveProperty("viewingSessionId")
    })

    it("removes task fields when version < 9", () => {
      const state = {
        sidebarWidth: 25,
        taskChatOpen: true,
        taskChatWidth: 30,
        showToolOutput: false,
        theme: "system",
        currentTaskChatSessionId: null,
        isSearchVisible: false,
        taskChatInputDraft: "",
        workspace: null,
        branch: null,
        issuePrefix: null,
        accentColor: null,
        instances: [],
        activeInstanceId: "default",
        taskSearchQuery: "test",
        selectedTaskId: "task-1",
        closedTimeFilter: "past_day",
        statusCollapsedState: { open: true, deferred: false, closed: false },
        parentCollapsedState: {},
        taskInputDraft: "draft",
        commentDrafts: { "task-1": "comment" },
        tasks: [{ id: "task-1", title: "Task 1", status: "open" }],
      } as unknown as PersistedState

      const result = migrate(state, 8)

      const resultRecord = result as unknown as Record<string, unknown>
      expect(resultRecord.taskSearchQuery).toBeUndefined()
      expect(resultRecord.selectedTaskId).toBeUndefined()
      expect(resultRecord.closedTimeFilter).toBeUndefined()
      expect(resultRecord.statusCollapsedState).toBeUndefined()
      expect(resultRecord.parentCollapsedState).toBeUndefined()
      expect(resultRecord.taskInputDraft).toBeUndefined()
      expect(resultRecord.commentDrafts).toBeUndefined()
      expect(resultRecord.tasks).toBeUndefined()
    })
  })
})
