import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { RalphInstance, ChatEvent, Task } from "@/types"
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
  type SerializedRalphInstance,
  type PersistedState,
} from "./persist"
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
    currentTaskTitle: null,
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
  const instances = new Map([[DEFAULT_INSTANCE_ID, defaultInstance]])

  return {
    instances,
    activeInstanceId: DEFAULT_INSTANCE_ID,
    ralphStatus: "stopped",
    runStartedAt: null,
    initialTaskCount: null,
    events: [],
    tasks: [],
    workspace: null,
    branch: null,
    issuePrefix: null,
    tokenUsage: { input: 0, output: 0 },
    contextWindow: { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
    session: { current: 0, total: 0 },
    connectionStatus: "disconnected",
    accentColor: null,
    sidebarWidth: 320,
    theme: "system",
    viewingEventLogId: null,
    viewingEventLog: null,
    eventLogLoading: false,
    eventLogError: null,
    taskChatOpen: true,
    taskChatWidth: 400,
    taskChatMessages: [],
    taskChatLoading: false,
    viewingSessionIndex: null,
    taskSearchQuery: "",
    selectedTaskId: null,
    visibleTaskIds: [],
    closedTimeFilter: "past_day",
    showToolOutput: false,
    isSearchVisible: false,
    hotkeysDialogOpen: false,
    wasRunningBeforeDisconnect: false,
    taskChatEvents: [],
    ...overrides,
  } as AppState & AppActions
}

describe("persist", () => {
  describe("constants", () => {
    it("exports PERSIST_VERSION", () => {
      expect(PERSIST_VERSION).toBe(1)
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

    it("includes events only for the active instance", () => {
      const events: ChatEvent[] = [
        createMockEvent({ content: "event 1" }),
        createMockEvent({ content: "event 2" }),
      ]

      const instances = new Map<string, RalphInstance>([
        ["active", createMockInstance({ id: "active", events })],
        ["inactive", createMockInstance({ id: "inactive", events })],
      ])

      const result = serializeInstances(instances, "active")

      const activeResult = result.find(i => i.id === "active")
      const inactiveResult = result.find(i => i.id === "inactive")

      expect(activeResult?.events).toHaveLength(2)
      expect(inactiveResult?.events).toHaveLength(0)
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
        currentTaskTitle: "Fix bug",
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
        currentTaskTitle: "Fix bug",
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
          events: [],
          tokenUsage: { input: 0, output: 0 },
          contextWindow: { used: 0, max: 200000 },
          session: { current: 0, total: 0 },
          worktreePath: null,
          branch: null,
          currentTaskId: null,
          currentTaskTitle: null,
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

    it("restores RalphInstance with proper structure", () => {
      const serialized: SerializedRalphInstance[] = [
        {
          id: "test",
          name: "Test Instance",
          agentName: "Ralph-1",
          status: "running",
          events: [createMockEvent()],
          tokenUsage: { input: 100, output: 50 },
          contextWindow: { used: 5000, max: 200000 },
          session: { current: 2, total: 5 },
          worktreePath: "/path/to/worktree",
          branch: "feature-branch",
          currentTaskId: "task-123",
          currentTaskTitle: "Fix bug",
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
      expect(instance?.events).toHaveLength(1)
      expect(instance?.tokenUsage).toEqual({ input: 100, output: 50 })
      expect(instance?.contextWindow).toEqual({ used: 5000, max: 200000 })
      expect(instance?.session).toEqual({ current: 2, total: 5 })
      expect(instance?.worktreePath).toBe("/path/to/worktree")
      expect(instance?.branch).toBe("feature-branch")
      expect(instance?.currentTaskId).toBe("task-123")
      expect(instance?.currentTaskTitle).toBe("Fix bug")
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
          events: [],
          tokenUsage: undefined as any,
          contextWindow: undefined as any,
          session: undefined as any,
          worktreePath: null,
          branch: null,
          currentTaskId: null,
          currentTaskTitle: null,
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
          events: [],
          tokenUsage: { input: 0, output: 0 },
          contextWindow: { used: 0, max: 200000 },
          session: { current: 0, total: 0 },
          worktreePath: null,
          branch: null,
          currentTaskId: null,
          currentTaskTitle: null,
          createdAt: 1234567890,
          runStartedAt: null,
          mergeConflict: null,
        },
        {
          id: "two",
          name: "Two",
          agentName: "Ralph-2",
          status: "running",
          events: [],
          tokenUsage: { input: 10, output: 5 },
          contextWindow: { used: 100, max: 200000 },
          session: { current: 1, total: 3 },
          worktreePath: "/worktree",
          branch: "feature",
          currentTaskId: "task-1",
          currentTaskTitle: "Task One",
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
        closedTimeFilter: "past_week",
        viewingSessionIndex: 2,
        taskSearchQuery: "search term",
        selectedTaskId: "task-123",
        isSearchVisible: true,
        workspace: "/path/to/workspace",
        branch: "main",
        issuePrefix: "TEST",
        accentColor: "#ff0000",
        tasks: [{ id: "task-1", title: "Task 1", status: "open" } as Task],
      })

      const result = partialize(state)

      expect(result).toEqual({
        sidebarWidth: 400,
        taskChatOpen: false,
        taskChatWidth: 500,
        showToolOutput: true,
        theme: "dark",
        closedTimeFilter: "past_week",
        viewingSessionIndex: 2,
        taskSearchQuery: "search term",
        selectedTaskId: "task-123",
        isSearchVisible: true,
        workspace: "/path/to/workspace",
        branch: "main",
        issuePrefix: "TEST",
        accentColor: "#ff0000",
        tasks: [{ id: "task-1", title: "Task 1", status: "open" }],
        instances: expect.any(Array),
        activeInstanceId: DEFAULT_INSTANCE_ID,
      })
    })

    it("excludes runtime-only fields", () => {
      const state = createMockAppState({
        connectionStatus: "connected",
        ralphStatus: "running",
        viewingEventLogId: "log-123",
        viewingEventLog: { id: "log-123", createdAt: "", events: [] },
        eventLogLoading: true,
        eventLogError: "some error",
        taskChatMessages: [{ id: "1", role: "user", content: "hi", timestamp: 0 }],
        taskChatLoading: true,
        taskChatEvents: [createMockEvent()],
        hotkeysDialogOpen: true,
        visibleTaskIds: ["task-1", "task-2"],
        runStartedAt: Date.now(),
        initialTaskCount: 5,
        wasRunningBeforeDisconnect: true,
      })

      const result = partialize(state)

      // These should NOT be in the result
      expect(result).not.toHaveProperty("connectionStatus")
      expect(result).not.toHaveProperty("ralphStatus")
      expect(result).not.toHaveProperty("viewingEventLogId")
      expect(result).not.toHaveProperty("viewingEventLog")
      expect(result).not.toHaveProperty("eventLogLoading")
      expect(result).not.toHaveProperty("eventLogError")
      expect(result).not.toHaveProperty("taskChatMessages")
      expect(result).not.toHaveProperty("taskChatLoading")
      expect(result).not.toHaveProperty("taskChatEvents")
      expect(result).not.toHaveProperty("hotkeysDialogOpen")
      expect(result).not.toHaveProperty("visibleTaskIds")
      expect(result).not.toHaveProperty("runStartedAt")
      expect(result).not.toHaveProperty("initialTaskCount")
      expect(result).not.toHaveProperty("wasRunningBeforeDisconnect")
    })

    it("serializes instances correctly", () => {
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
      expect(result.instances[0].events).toHaveLength(1) // Active instance includes events
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
      expect(persistConfig.version).toBe(PERSIST_VERSION)
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
          closedTimeFilter: "past_week",
          currentTaskChatSessionId: null,
          viewingSessionIndex: 3,
          taskSearchQuery: "test",
          selectedTaskId: "selected",
          isSearchVisible: true,
          workspace: "/new/workspace",
          branch: "develop",
          issuePrefix: "DEV",
          accentColor: "#00ff00",
          tasks: [{ id: "task-2", title: "Task 2", status: "closed" } as Task],
          instances: [
            {
              id: DEFAULT_INSTANCE_ID,
              name: "Main",
              agentName: "Ralph",
              status: "stopped",
              events: [],
              tokenUsage: { input: 0, output: 0 },
              contextWindow: { used: 0, max: 200000 },
              session: { current: 0, total: 0 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              currentTaskTitle: null,
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
        expect(result.tasks).toHaveLength(1)
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
              events: [],
              tokenUsage: { input: 0, output: 0 },
              contextWindow: { used: 0, max: 200000 },
              session: { current: 0, total: 0 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              currentTaskTitle: null,
              createdAt: 1234567890,
              runStartedAt: null,
              mergeConflict: null,
            },
            {
              id: "instance-b",
              name: "Instance B",
              agentName: "Ralph-2",
              status: "running",
              events: [createMockEvent()],
              tokenUsage: { input: 10, output: 5 },
              contextWindow: { used: 100, max: 200000 },
              session: { current: 1, total: 2 },
              worktreePath: "/worktree",
              branch: "feature",
              currentTaskId: "task-1",
              currentTaskTitle: "Task",
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
              events: [],
              tokenUsage: { input: 0, output: 0 },
              contextWindow: { used: 0, max: 200000 },
              session: { current: 0, total: 0 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              currentTaskTitle: null,
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

      it("syncs flat fields from active instance", () => {
        const currentState = createMockAppState()
        const events = [createMockEvent()]
        const persistedState: PersistedState = {
          ...partialize(currentState),
          instances: [
            {
              id: "active",
              name: "Active",
              agentName: "Ralph",
              status: "running",
              events,
              tokenUsage: { input: 100, output: 50 },
              contextWindow: { used: 5000, max: 200000 },
              session: { current: 2, total: 5 },
              worktreePath: null,
              branch: null,
              currentTaskId: null,
              currentTaskTitle: null,
              createdAt: 1234567890,
              runStartedAt: 1234567900,
              mergeConflict: null,
            },
          ],
          activeInstanceId: "active",
        }

        const result = persistConfig.merge!(persistedState, currentState)

        // Flat fields should be synced from the active instance
        expect(result.ralphStatus).toBe("running")
        expect(result.events).toEqual(events)
        expect(result.tokenUsage).toEqual({ input: 100, output: 50 })
        expect(result.contextWindow).toEqual({ used: 5000, max: 200000 })
        expect(result.session).toEqual({ current: 2, total: 5 })
        expect(result.runStartedAt).toBe(1234567900)
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
    it("can serialize and deserialize instances without data loss", () => {
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
            currentTaskTitle: "Active Task",
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
            events: [], // Will not be preserved for inactive
            tokenUsage: { input: 10, output: 5 },
            contextWindow: { used: 100, max: 200000 },
            session: { current: 1, total: 2 },
            worktreePath: "/worktree/inactive",
            branch: "feature-inactive",
            currentTaskId: null,
            currentTaskTitle: null,
            createdAt: 1234567891,
            runStartedAt: null,
            mergeConflict: null,
          }),
        ],
      ])

      const serialized = serializeInstances(instances, "active")
      const deserialized = deserializeInstances(serialized)

      // Active instance should be fully preserved
      const activeOriginal = instances.get("active")!
      const activeRestored = deserialized.get("active")!

      expect(activeRestored.id).toBe(activeOriginal.id)
      expect(activeRestored.name).toBe(activeOriginal.name)
      expect(activeRestored.agentName).toBe(activeOriginal.agentName)
      expect(activeRestored.status).toBe(activeOriginal.status)
      expect(activeRestored.events).toEqual(activeOriginal.events)
      expect(activeRestored.tokenUsage).toEqual(activeOriginal.tokenUsage)
      expect(activeRestored.contextWindow).toEqual(activeOriginal.contextWindow)
      expect(activeRestored.session).toEqual(activeOriginal.session)
      expect(activeRestored.worktreePath).toBe(activeOriginal.worktreePath)
      expect(activeRestored.branch).toBe(activeOriginal.branch)
      expect(activeRestored.currentTaskId).toBe(activeOriginal.currentTaskId)
      expect(activeRestored.currentTaskTitle).toBe(activeOriginal.currentTaskTitle)
      expect(activeRestored.createdAt).toBe(activeOriginal.createdAt)
      expect(activeRestored.runStartedAt).toBe(activeOriginal.runStartedAt)
      expect(activeRestored.mergeConflict).toEqual(activeOriginal.mergeConflict)

      // Inactive instance should have empty events
      const inactiveRestored = deserialized.get("inactive")!
      expect(inactiveRestored.events).toEqual([])
    })
  })
})
