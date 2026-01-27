import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  useAppStore,
  selectCurrentTask,
  isSessionBoundary,
  getSessionBoundaries,
  countSessions,
  getEventsForSession,
  getTaskFromSessionEvents,
  getSessionTaskInfos,
  selectSessionCount,
  selectCurrentSessionEvents,
  selectViewingSessionIndex,
  selectIsViewingLatestSession,
  selectSessionTask,
  // Instance-related exports
  DEFAULT_INSTANCE_ID,
  DEFAULT_INSTANCE_NAME,
  DEFAULT_AGENT_NAME,
  DEFAULT_CONTEXT_WINDOW_MAX,
  createRalphInstance,
  selectInstances,
  selectActiveInstanceId,
  selectActiveInstance,
  selectInstance,
  selectInstanceCount,
  // Delegating selectors
  selectRalphStatus,
  selectRunStartedAt,
  selectEvents,
  selectTokenUsage,
  selectContextWindow,
  selectSession,
  // Per-instance selectors
  selectInstanceStatus,
  selectInstanceEvents,
  selectInstanceTokenUsage,
  selectInstanceContextWindow,
  selectInstanceSession,
  selectInstanceRunStartedAt,
  selectInstanceWorktreePath,
  selectInstanceBranch,
  selectInstanceCurrentTaskId,
  selectInstanceName,
  selectInstanceAgentName,
  selectInstanceCreatedAt,
  selectIsInstanceRunning,
  selectInstanceSessionCount,
  flushTaskChatEventsBatch,
  selectCanAcceptMessages,
} from "./index"
import type { ChatEvent, Task, TaskChatMessage } from "@/types"
import { PERSIST_NAME, type PersistedState, serializeInstances } from "./persist"

/**
 * Helper to create persisted state for localStorage tests.
 * Uses the persist middleware format with proper serialization.
 */
function createPersistedState(overrides: Partial<PersistedState>): string {
  const defaultInstance = createRalphInstance(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_NAME)
  const defaultInstances = new Map([[DEFAULT_INSTANCE_ID, defaultInstance]])

  const state: PersistedState = {
    sidebarWidth: 320,
    taskChatOpen: true,
    taskChatWidth: 400,
    showToolOutput: false,
    theme: "system",
    closedTimeFilter: "past_day",
    vscodeThemeId: null,
    lastDarkThemeId: null,
    lastLightThemeId: null,
    currentTaskChatSessionId: null,
    viewingSessionIndex: null,
    taskSearchQuery: "",
    selectedTaskId: null,
    isSearchVisible: false,
    statusCollapsedState: { open: false, deferred: true, closed: true },
    parentCollapsedState: {},
    taskInputDraft: "",
    taskChatInputDraft: "",
    workspace: null,
    branch: null,
    issuePrefix: null,
    accentColor: null,
    tasks: [],
    instances: serializeInstances(defaultInstances, DEFAULT_INSTANCE_ID),
    activeInstanceId: DEFAULT_INSTANCE_ID,
    ...overrides,
  }

  return JSON.stringify({ state, version: 1 })
}

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.getState().reset()
    // Silence console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("initial state", () => {
    it("has correct initial values", () => {
      const state = useAppStore.getState()
      expect(state.ralphStatus).toBe("stopped")
      expect(state.events).toEqual([])
      expect(state.tasks).toEqual([])
      expect(state.workspace).toBeNull()
      expect(state.branch).toBeNull()
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(state.contextWindow).toEqual({ used: 0, max: 200_000 })
      expect(state.session).toEqual({ current: 0, total: 0 })
      expect(state.connectionStatus).toBe("disconnected")
      expect(state.accentColor).toBeNull()
      expect(state.sidebarWidth).toBe(320)
      expect(state.taskChatOpen).toBe(true)
      expect(state.taskChatWidth).toBe(400)
      expect(state.taskChatMessages).toEqual([])
      expect(state.taskChatLoading).toBe(false)
      expect(state.taskChatEvents).toEqual([])
      expect(state.viewingSessionIndex).toBeNull()
    })

    it("has instances Map with default instance", () => {
      const state = useAppStore.getState()
      expect(state.instances).toBeInstanceOf(Map)
      expect(state.instances.size).toBe(1)
      expect(state.instances.has(DEFAULT_INSTANCE_ID)).toBe(true)
    })

    it("has activeInstanceId set to default", () => {
      const state = useAppStore.getState()
      expect(state.activeInstanceId).toBe(DEFAULT_INSTANCE_ID)
    })

    it("default instance has correct initial values", () => {
      const state = useAppStore.getState()
      const defaultInstance = state.instances.get(DEFAULT_INSTANCE_ID)
      expect(defaultInstance).toBeDefined()
      expect(defaultInstance?.id).toBe(DEFAULT_INSTANCE_ID)
      expect(defaultInstance?.name).toBe(DEFAULT_INSTANCE_NAME)
      expect(defaultInstance?.agentName).toBe(DEFAULT_AGENT_NAME)
      expect(defaultInstance?.status).toBe("stopped")
      expect(defaultInstance?.events).toEqual([])
      expect(defaultInstance?.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(defaultInstance?.contextWindow).toEqual({ used: 0, max: 200_000 })
      expect(defaultInstance?.session).toEqual({ current: 0, total: 0 })
      expect(defaultInstance?.worktreePath).toBeNull()
      expect(defaultInstance?.branch).toBeNull()
      expect(defaultInstance?.currentTaskId).toBeNull()
      expect(defaultInstance?.createdAt).toBeGreaterThan(0)
      expect(defaultInstance?.runStartedAt).toBeNull()
    })
  })

  describe("createRalphInstance helper", () => {
    it("creates instance with provided id", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.id).toBe("test-id")
      expect(instance.name).toBe(DEFAULT_INSTANCE_NAME)
      expect(instance.agentName).toBe(DEFAULT_AGENT_NAME)
    })

    it("creates instance with custom name and agent", () => {
      const instance = createRalphInstance("test-id", "Custom Name", "Custom Agent")
      expect(instance.id).toBe("test-id")
      expect(instance.name).toBe("Custom Name")
      expect(instance.agentName).toBe("Custom Agent")
    })

    it("creates instance with stopped status", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.status).toBe("stopped")
    })

    it("creates instance with empty events array", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.events).toEqual([])
    })

    it("creates instance with zero token usage", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.tokenUsage).toEqual({ input: 0, output: 0 })
    })

    it("creates instance with default context window", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.contextWindow).toEqual({ used: 0, max: 200_000 })
    })

    it("creates instance with zero session progress", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.session).toEqual({ current: 0, total: 0 })
    })

    it("creates instance with null worktree and branch", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.worktreePath).toBeNull()
      expect(instance.branch).toBeNull()
    })

    it("creates instance with createdAt timestamp", () => {
      const before = Date.now()
      const instance = createRalphInstance("test-id")
      const after = Date.now()
      expect(instance.createdAt).toBeGreaterThanOrEqual(before)
      expect(instance.createdAt).toBeLessThanOrEqual(after)
    })

    it("creates instance with null runStartedAt", () => {
      const instance = createRalphInstance("test-id")
      expect(instance.runStartedAt).toBeNull()
    })
  })

  describe("instance selectors", () => {
    it("selectInstances returns the instances Map", () => {
      const state = useAppStore.getState()
      const instances = selectInstances(state)
      expect(instances).toBeInstanceOf(Map)
      expect(instances.size).toBe(1)
    })

    it("selectActiveInstanceId returns the active instance ID", () => {
      const state = useAppStore.getState()
      expect(selectActiveInstanceId(state)).toBe(DEFAULT_INSTANCE_ID)
    })

    it("selectActiveInstance returns the active instance", () => {
      const state = useAppStore.getState()
      const activeInstance = selectActiveInstance(state)
      expect(activeInstance).not.toBeNull()
      expect(activeInstance?.id).toBe(DEFAULT_INSTANCE_ID)
    })

    it("selectInstance returns instance by ID", () => {
      const state = useAppStore.getState()
      const instance = selectInstance(state, DEFAULT_INSTANCE_ID)
      expect(instance).not.toBeNull()
      expect(instance?.id).toBe(DEFAULT_INSTANCE_ID)
    })

    it("selectInstance returns null for non-existent ID", () => {
      const state = useAppStore.getState()
      const instance = selectInstance(state, "non-existent")
      expect(instance).toBeNull()
    })

    it("selectInstanceCount returns number of instances", () => {
      const state = useAppStore.getState()
      expect(selectInstanceCount(state)).toBe(1)
    })
  })

  describe("per-instance selectors", () => {
    it("selectInstanceStatus returns status for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceStatus(state, DEFAULT_INSTANCE_ID)).toBe("stopped")
    })

    it("selectInstanceStatus returns stopped for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceStatus(state, "non-existent")).toBe("stopped")
    })

    it("selectInstanceStatus reflects status changes", () => {
      useAppStore.getState().setRalphStatus("running")
      const state = useAppStore.getState()
      expect(selectInstanceStatus(state, DEFAULT_INSTANCE_ID)).toBe("running")
    })

    it("selectInstanceEvents returns events for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceEvents(state, DEFAULT_INSTANCE_ID)).toEqual([])
    })

    it("selectInstanceEvents returns empty array for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceEvents(state, "non-existent")).toEqual([])
    })

    it("selectInstanceEvents reflects added events", () => {
      const event = { type: "test", timestamp: 12345 }
      useAppStore.getState().addEvent(event)
      const state = useAppStore.getState()
      expect(selectInstanceEvents(state, DEFAULT_INSTANCE_ID)).toHaveLength(1)
      expect(selectInstanceEvents(state, DEFAULT_INSTANCE_ID)[0]).toEqual(event)
    })

    it("selectInstanceTokenUsage returns token usage for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceTokenUsage(state, DEFAULT_INSTANCE_ID)).toEqual({
        input: 0,
        output: 0,
      })
    })

    it("selectInstanceTokenUsage returns defaults for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceTokenUsage(state, "non-existent")).toEqual({ input: 0, output: 0 })
    })

    it("selectInstanceTokenUsage reflects token usage changes", () => {
      useAppStore.getState().setTokenUsage({ input: 1000, output: 500 })
      const state = useAppStore.getState()
      expect(selectInstanceTokenUsage(state, DEFAULT_INSTANCE_ID)).toEqual({
        input: 1000,
        output: 500,
      })
    })

    it("selectInstanceContextWindow returns context window for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceContextWindow(state, DEFAULT_INSTANCE_ID)).toEqual({
        used: 0,
        max: DEFAULT_CONTEXT_WINDOW_MAX,
      })
    })

    it("selectInstanceContextWindow returns defaults for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceContextWindow(state, "non-existent")).toEqual({
        used: 0,
        max: DEFAULT_CONTEXT_WINDOW_MAX,
      })
    })

    it("selectInstanceContextWindow reflects context window changes", () => {
      useAppStore.getState().setContextWindow({ used: 50000, max: 200000 })
      const state = useAppStore.getState()
      expect(selectInstanceContextWindow(state, DEFAULT_INSTANCE_ID)).toEqual({
        used: 50000,
        max: 200000,
      })
    })

    it("selectInstanceSession returns session for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceSession(state, DEFAULT_INSTANCE_ID)).toEqual({
        current: 0,
        total: 0,
      })
    })

    it("selectInstanceSession returns defaults for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceSession(state, "non-existent")).toEqual({ current: 0, total: 0 })
    })

    it("selectInstanceSession reflects session changes", () => {
      useAppStore.getState().setSession({ current: 3, total: 10 })
      const state = useAppStore.getState()
      expect(selectInstanceSession(state, DEFAULT_INSTANCE_ID)).toEqual({
        current: 3,
        total: 10,
      })
    })

    it("selectInstanceRunStartedAt returns null for default instance initially", () => {
      const state = useAppStore.getState()
      expect(selectInstanceRunStartedAt(state, DEFAULT_INSTANCE_ID)).toBeNull()
    })

    it("selectInstanceRunStartedAt returns null for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceRunStartedAt(state, "non-existent")).toBeNull()
    })

    it("selectInstanceRunStartedAt reflects when running", () => {
      const before = Date.now()
      useAppStore.getState().setRalphStatus("running")
      const after = Date.now()
      const state = useAppStore.getState()
      const runStartedAt = selectInstanceRunStartedAt(state, DEFAULT_INSTANCE_ID)
      expect(runStartedAt).toBeGreaterThanOrEqual(before)
      expect(runStartedAt).toBeLessThanOrEqual(after)
    })

    it("selectInstanceWorktreePath returns null for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceWorktreePath(state, DEFAULT_INSTANCE_ID)).toBeNull()
    })

    it("selectInstanceWorktreePath returns null for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceWorktreePath(state, "non-existent")).toBeNull()
    })

    it("selectInstanceBranch returns null for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceBranch(state, DEFAULT_INSTANCE_ID)).toBeNull()
    })

    it("selectInstanceBranch returns null for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceBranch(state, "non-existent")).toBeNull()
    })

    it("selectInstanceCurrentTaskId returns null for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceCurrentTaskId(state, DEFAULT_INSTANCE_ID)).toBeNull()
    })

    it("selectInstanceCurrentTaskId returns null for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceCurrentTaskId(state, "non-existent")).toBeNull()
    })

    it("selectInstanceName returns name for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceName(state, DEFAULT_INSTANCE_ID)).toBe(DEFAULT_INSTANCE_NAME)
    })

    it("selectInstanceName returns empty string for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceName(state, "non-existent")).toBe("")
    })

    it("selectInstanceAgentName returns agent name for default instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceAgentName(state, DEFAULT_INSTANCE_ID)).toBe(DEFAULT_AGENT_NAME)
    })

    it("selectInstanceAgentName returns default for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceAgentName(state, "non-existent")).toBe(DEFAULT_AGENT_NAME)
    })

    it("selectInstanceCreatedAt returns timestamp for default instance", () => {
      const state = useAppStore.getState()
      const createdAt = selectInstanceCreatedAt(state, DEFAULT_INSTANCE_ID)
      expect(createdAt).toBeGreaterThan(0)
    })

    it("selectInstanceCreatedAt returns null for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceCreatedAt(state, "non-existent")).toBeNull()
    })

    it("selectIsInstanceRunning returns false for default instance initially", () => {
      const state = useAppStore.getState()
      expect(selectIsInstanceRunning(state, DEFAULT_INSTANCE_ID)).toBe(false)
    })

    it("selectIsInstanceRunning returns false for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectIsInstanceRunning(state, "non-existent")).toBe(false)
    })

    it("selectIsInstanceRunning returns true when running", () => {
      useAppStore.getState().setRalphStatus("running")
      const state = useAppStore.getState()
      expect(selectIsInstanceRunning(state, DEFAULT_INSTANCE_ID)).toBe(true)
    })

    it("selectInstanceSessionCount returns 0 for default instance initially", () => {
      const state = useAppStore.getState()
      expect(selectInstanceSessionCount(state, DEFAULT_INSTANCE_ID)).toBe(0)
    })

    it("selectInstanceSessionCount returns 0 for non-existent instance", () => {
      const state = useAppStore.getState()
      expect(selectInstanceSessionCount(state, "non-existent")).toBe(0)
    })

    it("selectInstanceSessionCount counts session boundaries in events", () => {
      useAppStore.getState().addEvent({ type: "system", subtype: "init", timestamp: 1 })
      useAppStore.getState().addEvent({ type: "assistant", timestamp: 2 })
      useAppStore.getState().addEvent({ type: "system", subtype: "init", timestamp: 3 })
      const state = useAppStore.getState()
      expect(selectInstanceSessionCount(state, DEFAULT_INSTANCE_ID)).toBe(2)
    })
  })

  describe("setActiveInstanceId action", () => {
    it("does nothing when instance does not exist", () => {
      const state = useAppStore.getState()
      const originalActiveId = state.activeInstanceId

      useAppStore.getState().setActiveInstanceId("non-existent-id")

      expect(useAppStore.getState().activeInstanceId).toBe(originalActiveId)
    })

    it("does nothing when switching to the same instance", () => {
      const state = useAppStore.getState()
      const originalActiveId = state.activeInstanceId

      useAppStore.getState().setActiveInstanceId(originalActiveId)

      expect(useAppStore.getState().activeInstanceId).toBe(originalActiveId)
    })

    it("switches to existing instance", () => {
      // Create a second instance manually in the instances Map
      const state = useAppStore.getState()
      const newInstance = createRalphInstance("second-instance", "Second", "Agent2")
      newInstance.status = "running"
      newInstance.events = [{ type: "test-event", timestamp: 123 }]
      newInstance.tokenUsage = { input: 500, output: 250 }
      newInstance.contextWindow = { used: 10000, max: 200000 }
      newInstance.session = { current: 2, total: 5 }
      newInstance.runStartedAt = 12345

      // Add the new instance to the Map
      const newInstances = new Map(state.instances)
      newInstances.set("second-instance", newInstance)
      useAppStore.setState({ instances: newInstances })

      // Switch to the new instance
      useAppStore.getState().setActiveInstanceId("second-instance")

      // Verify activeInstanceId changed
      expect(useAppStore.getState().activeInstanceId).toBe("second-instance")
    })

    it("syncs flat fields when switching instance", () => {
      // Create a second instance with distinct state
      const state = useAppStore.getState()
      const newInstance = createRalphInstance("second-instance", "Second", "Agent2")
      newInstance.status = "running"
      newInstance.events = [{ type: "test-event", timestamp: 123 }]
      newInstance.tokenUsage = { input: 500, output: 250 }
      newInstance.contextWindow = { used: 10000, max: 200000 }
      newInstance.session = { current: 2, total: 5 }
      newInstance.runStartedAt = 12345

      // Add the new instance to the Map
      const newInstances = new Map(state.instances)
      newInstances.set("second-instance", newInstance)
      useAppStore.setState({ instances: newInstances })

      // Switch to the new instance
      useAppStore.getState().setActiveInstanceId("second-instance")

      // Verify flat fields are synced from the new active instance
      const updatedState = useAppStore.getState()
      expect(updatedState.ralphStatus).toBe("running")
      expect(updatedState.events).toEqual([{ type: "test-event", timestamp: 123 }])
      expect(updatedState.tokenUsage).toEqual({ input: 500, output: 250 })
      expect(updatedState.contextWindow).toEqual({ used: 10000, max: 200000 })
      expect(updatedState.session).toEqual({ current: 2, total: 5 })
      expect(updatedState.runStartedAt).toBe(12345)
    })

    it("resets viewingSessionIndex when switching instance", () => {
      // Set a viewing session index
      useAppStore.getState().setViewingSessionIndex(3)
      expect(useAppStore.getState().viewingSessionIndex).toBe(3)

      // Create and add a second instance
      const state = useAppStore.getState()
      const newInstance = createRalphInstance("second-instance")
      const newInstances = new Map(state.instances)
      newInstances.set("second-instance", newInstance)
      useAppStore.setState({ instances: newInstances })

      // Switch to the new instance
      useAppStore.getState().setActiveInstanceId("second-instance")

      // Verify viewingSessionIndex is reset
      expect(useAppStore.getState().viewingSessionIndex).toBeNull()
    })

    it("allows switching back to original instance", () => {
      // Create a second instance
      const state = useAppStore.getState()
      const newInstance = createRalphInstance("second-instance")
      const newInstances = new Map(state.instances)
      newInstances.set("second-instance", newInstance)
      useAppStore.setState({ instances: newInstances })

      // Switch to second instance
      useAppStore.getState().setActiveInstanceId("second-instance")
      expect(useAppStore.getState().activeInstanceId).toBe("second-instance")

      // Switch back to default
      useAppStore.getState().setActiveInstanceId(DEFAULT_INSTANCE_ID)
      expect(useAppStore.getState().activeInstanceId).toBe(DEFAULT_INSTANCE_ID)
    })
  })

  describe("createInstance action", () => {
    it("creates a new instance with the provided ID", () => {
      useAppStore.getState().createInstance("new-instance")

      const state = useAppStore.getState()
      expect(state.instances.has("new-instance")).toBe(true)
      expect(state.instances.size).toBe(2) // default + new
    })

    it("creates instance with default name and agent when not provided", () => {
      useAppStore.getState().createInstance("new-instance")

      const state = useAppStore.getState()
      const newInstance = state.instances.get("new-instance")
      expect(newInstance?.name).toBe(DEFAULT_INSTANCE_NAME)
      expect(newInstance?.agentName).toBe(DEFAULT_AGENT_NAME)
    })

    it("creates instance with custom name when provided", () => {
      useAppStore.getState().createInstance("custom-instance", "Custom Name")

      const state = useAppStore.getState()
      const newInstance = state.instances.get("custom-instance")
      expect(newInstance?.name).toBe("Custom Name")
      expect(newInstance?.agentName).toBe(DEFAULT_AGENT_NAME)
    })

    it("creates instance with custom name and agent when provided", () => {
      useAppStore.getState().createInstance("custom-instance", "Custom Name", "Custom Agent")

      const state = useAppStore.getState()
      const newInstance = state.instances.get("custom-instance")
      expect(newInstance?.name).toBe("Custom Name")
      expect(newInstance?.agentName).toBe("Custom Agent")
    })

    it("creates instance with initial stopped status", () => {
      useAppStore.getState().createInstance("new-instance")

      const state = useAppStore.getState()
      const newInstance = state.instances.get("new-instance")
      expect(newInstance?.status).toBe("stopped")
    })

    it("creates instance with empty events and zero token usage", () => {
      useAppStore.getState().createInstance("new-instance")

      const state = useAppStore.getState()
      const newInstance = state.instances.get("new-instance")
      expect(newInstance?.events).toEqual([])
      expect(newInstance?.tokenUsage).toEqual({ input: 0, output: 0 })
    })

    it("creates instance with createdAt timestamp", () => {
      const before = Date.now()
      useAppStore.getState().createInstance("new-instance")
      const after = Date.now()

      const state = useAppStore.getState()
      const newInstance = state.instances.get("new-instance")
      expect(newInstance?.createdAt).toBeGreaterThanOrEqual(before)
      expect(newInstance?.createdAt).toBeLessThanOrEqual(after)
    })

    it("does nothing when instance with same ID already exists", () => {
      // Create first instance
      useAppStore.getState().createInstance("test-instance", "First")
      expect(useAppStore.getState().instances.size).toBe(2)

      // Try to create with same ID
      useAppStore.getState().createInstance("test-instance", "Second")

      // Should still have same count, and first name should be preserved
      const state = useAppStore.getState()
      expect(state.instances.size).toBe(2)
      expect(state.instances.get("test-instance")?.name).toBe("First")
    })

    it("auto-selects the newly created instance", () => {
      expect(useAppStore.getState().activeInstanceId).toBe(DEFAULT_INSTANCE_ID)

      useAppStore.getState().createInstance("new-instance")

      expect(useAppStore.getState().activeInstanceId).toBe("new-instance")
    })

    it("syncs flat fields when auto-selecting newly created instance", () => {
      useAppStore.getState().createInstance("new-instance", "My Instance", "My Agent")

      const state = useAppStore.getState()
      // Verify flat fields are synced from the new instance
      expect(state.ralphStatus).toBe("stopped")
      expect(state.events).toEqual([])
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(state.contextWindow).toEqual({ used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX })
      expect(state.session).toEqual({ current: 0, total: 0 })
      expect(state.runStartedAt).toBeNull()
      expect(state.viewingSessionIndex).toBeNull()
    })

    it("can create multiple instances", () => {
      useAppStore.getState().createInstance("instance-1", "First")
      useAppStore.getState().createInstance("instance-2", "Second")
      useAppStore.getState().createInstance("instance-3", "Third")

      const state = useAppStore.getState()
      expect(state.instances.size).toBe(4) // default + 3 new
      expect(state.instances.has("instance-1")).toBe(true)
      expect(state.instances.has("instance-2")).toBe(true)
      expect(state.instances.has("instance-3")).toBe(true)
    })
  })

  describe("removeInstance action", () => {
    beforeEach(() => {
      // Create some instances for removal tests
      useAppStore.getState().createInstance("instance-1", "First")
      useAppStore.getState().createInstance("instance-2", "Second")
    })

    it("removes an existing instance", () => {
      expect(useAppStore.getState().instances.size).toBe(3) // default + 2

      useAppStore.getState().removeInstance("instance-1")

      const state = useAppStore.getState()
      expect(state.instances.size).toBe(2)
      expect(state.instances.has("instance-1")).toBe(false)
      expect(state.instances.has("instance-2")).toBe(true)
    })

    it("does nothing when trying to remove non-existent instance", () => {
      const initialSize = useAppStore.getState().instances.size

      useAppStore.getState().removeInstance("non-existent")

      expect(useAppStore.getState().instances.size).toBe(initialSize)
    })

    it("cannot remove the active instance", () => {
      // Switch to instance-1
      useAppStore.getState().setActiveInstanceId("instance-1")
      expect(useAppStore.getState().activeInstanceId).toBe("instance-1")

      // Try to remove active instance
      useAppStore.getState().removeInstance("instance-1")

      // Instance should still exist
      expect(useAppStore.getState().instances.has("instance-1")).toBe(true)
    })

    it("cannot remove the last instance", () => {
      // After beforeEach, active instance is "instance-2" (last created)
      // Remove other instances first
      useAppStore.getState().removeInstance("instance-1")
      useAppStore.getState().removeInstance(DEFAULT_INSTANCE_ID)

      expect(useAppStore.getState().instances.size).toBe(1)
      expect(useAppStore.getState().instances.has("instance-2")).toBe(true)

      // Try to remove the last remaining instance (which is also active)
      // It should fail because it's the active instance
      useAppStore.getState().removeInstance("instance-2")

      const state = useAppStore.getState()
      expect(state.instances.size).toBe(1)
      expect(state.instances.has("instance-2")).toBe(true)
    })

    it("preserves activeInstanceId after removing other instances", () => {
      // After beforeEach, active instance is "instance-2" (last created)
      expect(useAppStore.getState().activeInstanceId).toBe("instance-2")

      useAppStore.getState().removeInstance("instance-1")
      useAppStore.getState().removeInstance(DEFAULT_INSTANCE_ID)

      expect(useAppStore.getState().activeInstanceId).toBe("instance-2")
    })

    it("does not affect other instances when removing one", () => {
      // Set up some state on instance-2
      const state = useAppStore.getState()
      const instance2 = state.instances.get("instance-2")!
      instance2.status = "running"
      instance2.events = [{ type: "test", timestamp: 123 }]
      const updatedInstances = new Map(state.instances)
      updatedInstances.set("instance-2", instance2)
      useAppStore.setState({ instances: updatedInstances })

      // Remove instance-1
      useAppStore.getState().removeInstance("instance-1")

      // instance-2 should still have its state
      const newState = useAppStore.getState()
      const stillInstance2 = newState.instances.get("instance-2")
      expect(stillInstance2?.status).toBe("running")
      expect(stillInstance2?.events).toHaveLength(1)
    })
  })

  describe("cleanupInstance action", () => {
    beforeEach(() => {
      // Create additional instances for testing
      useAppStore.getState().createInstance("instance-1", "First")
      useAppStore.getState().createInstance("instance-2", "Second")
      // Set instance-1 as active
      useAppStore.getState().setActiveInstanceId("instance-1")
    })

    it("resets instance runtime state to initial values", () => {
      // Set up some state on instance-1
      const state = useAppStore.getState()
      const instance = state.instances.get("instance-1")!
      const updatedInstance = {
        ...instance,
        status: "running" as const,
        events: [{ type: "test", timestamp: 123 }],
        tokenUsage: { input: 1000, output: 500 },
        contextWindow: { used: 50000, max: 200000 },
        session: { current: 3, total: 5 },
        runStartedAt: Date.now(),
        currentTaskId: "task-123",
      }
      const updatedInstances = new Map(state.instances)
      updatedInstances.set("instance-1", updatedInstance)
      useAppStore.setState({ instances: updatedInstances })

      // Cleanup the instance
      useAppStore.getState().cleanupInstance("instance-1")

      // Verify state was reset
      const newState = useAppStore.getState()
      const cleanedInstance = newState.instances.get("instance-1")
      expect(cleanedInstance?.status).toBe("stopped")
      expect(cleanedInstance?.events).toEqual([])
      expect(cleanedInstance?.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(cleanedInstance?.contextWindow.used).toBe(0)
      expect(cleanedInstance?.session).toEqual({ current: 0, total: 0 })
      expect(cleanedInstance?.runStartedAt).toBeNull()
      expect(cleanedInstance?.currentTaskId).toBeNull()
    })

    it("preserves instance identity (id, name, agentName, createdAt)", () => {
      const state = useAppStore.getState()
      const instanceBefore = state.instances.get("instance-1")!

      useAppStore.getState().cleanupInstance("instance-1")

      const instanceAfter = useAppStore.getState().instances.get("instance-1")
      expect(instanceAfter?.id).toBe(instanceBefore.id)
      expect(instanceAfter?.name).toBe(instanceBefore.name)
      expect(instanceAfter?.agentName).toBe(instanceBefore.agentName)
      expect(instanceAfter?.createdAt).toBe(instanceBefore.createdAt)
    })

    it("warns when cleaning up non-existent instance", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      useAppStore.getState().cleanupInstance("non-existent")

      expect(warnSpy).toHaveBeenCalledWith(
        "[store] Cannot cleanup non-existent instance: non-existent",
      )
      warnSpy.mockRestore()
    })

    it("updates flat fields when cleaning up the active instance", () => {
      // Set up state on the active instance (instance-1)
      useAppStore.getState().setRalphStatus("running")
      useAppStore.getState().addEvent({ type: "test", timestamp: 1 })
      useAppStore.getState().setTokenUsage({ input: 500, output: 250 })
      useAppStore.getState().setContextWindow({ used: 25000, max: 200000 })
      useAppStore.getState().setSession({ current: 2, total: 4 })

      // Cleanup the active instance
      useAppStore.getState().cleanupInstance("instance-1")

      // Verify flat fields were also reset
      const state = useAppStore.getState()
      expect(state.ralphStatus).toBe("stopped")
      expect(state.events).toEqual([])
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(state.contextWindow.used).toBe(0)
      expect(state.session).toEqual({ current: 0, total: 0 })
      expect(state.runStartedAt).toBeNull()
      expect(state.initialTaskCount).toBeNull()
      expect(state.viewingSessionIndex).toBeNull()
    })

    it("does not affect flat fields when cleaning up a non-active instance", () => {
      // Set up state on the active instance (instance-1)
      useAppStore.getState().setRalphStatus("running")
      useAppStore.getState().addEvent({ type: "test", timestamp: 1 })

      // Set up state on instance-2
      const state = useAppStore.getState()
      const instance2 = state.instances.get("instance-2")!
      const updatedInstance2 = {
        ...instance2,
        status: "running" as const,
        events: [{ type: "test2", timestamp: 456 }],
      }
      const updatedInstances = new Map(state.instances)
      updatedInstances.set("instance-2", updatedInstance2)
      useAppStore.setState({ instances: updatedInstances })

      // Cleanup instance-2 (non-active)
      useAppStore.getState().cleanupInstance("instance-2")

      // Verify flat fields were NOT affected
      const newState = useAppStore.getState()
      expect(newState.ralphStatus).toBe("running")
      expect(newState.events).toHaveLength(1)
    })

    it("does not affect other instances when cleaning up one", () => {
      // Set up state on instance-2
      const state = useAppStore.getState()
      const instance2 = state.instances.get("instance-2")!
      const updatedInstance2 = {
        ...instance2,
        status: "running" as const,
        events: [{ type: "test2", timestamp: 456 }],
      }
      const updatedInstances = new Map(state.instances)
      updatedInstances.set("instance-2", updatedInstance2)
      useAppStore.setState({ instances: updatedInstances })

      // Cleanup instance-1 (active)
      useAppStore.getState().cleanupInstance("instance-1")

      // Verify instance-2 was NOT affected
      const newState = useAppStore.getState()
      const stillInstance2 = newState.instances.get("instance-2")
      expect(stillInstance2?.status).toBe("running")
      expect(stillInstance2?.events).toHaveLength(1)
    })

    it("keeps instance in the Map after cleanup", () => {
      const initialCount = useAppStore.getState().instances.size

      useAppStore.getState().cleanupInstance("instance-1")

      expect(useAppStore.getState().instances.size).toBe(initialCount)
      expect(useAppStore.getState().instances.has("instance-1")).toBe(true)
    })

    it("preserves worktreePath and branch during cleanup", () => {
      // Set worktree and branch on instance
      const state = useAppStore.getState()
      const instance = state.instances.get("instance-1")!
      const updatedInstance = {
        ...instance,
        worktreePath: "/path/to/worktree",
        branch: "feature/test",
      }
      const updatedInstances = new Map(state.instances)
      updatedInstances.set("instance-1", updatedInstance)
      useAppStore.setState({ instances: updatedInstances })

      // Cleanup
      useAppStore.getState().cleanupInstance("instance-1")

      // Verify worktree and branch were preserved
      const cleanedInstance = useAppStore.getState().instances.get("instance-1")
      expect(cleanedInstance?.worktreePath).toBe("/path/to/worktree")
      expect(cleanedInstance?.branch).toBe("feature/test")
    })
  })

  describe("hydrateInstances action", () => {
    it("creates new instances from server data", () => {
      const initialCount = useAppStore.getState().instances.size

      useAppStore.getState().hydrateInstances([
        {
          id: "server-instance-1",
          name: "Server Instance 1",
          agentName: "Ralph-Server-1",
          worktreePath: "/path/to/worktree1",
          branch: "feature/branch1",
          createdAt: 1700000000000,
          currentTaskId: "task-1",
          currentTaskTitle: "Fix bug",
          status: "running",
          mergeConflict: null,
        },
        {
          id: "server-instance-2",
          name: "Server Instance 2",
          agentName: "Ralph-Server-2",
          worktreePath: null,
          branch: null,
          createdAt: 1700000001000,
          currentTaskId: null,
          currentTaskTitle: null,
          status: "stopped",
          mergeConflict: null,
        },
      ])

      const state = useAppStore.getState()
      expect(state.instances.size).toBe(initialCount + 2)
      expect(state.instances.has("server-instance-1")).toBe(true)
      expect(state.instances.has("server-instance-2")).toBe(true)

      const instance1 = state.instances.get("server-instance-1")!
      expect(instance1.name).toBe("Server Instance 1")
      expect(instance1.agentName).toBe("Ralph-Server-1")
      expect(instance1.worktreePath).toBe("/path/to/worktree1")
      expect(instance1.branch).toBe("feature/branch1")
      expect(instance1.status).toBe("running")
      expect(instance1.currentTaskId).toBe("task-1")
      expect(instance1.createdAt).toBe(1700000000000)
      // Runtime state should be initialized to defaults
      expect(instance1.events).toEqual([])
      expect(instance1.tokenUsage).toEqual({ input: 0, output: 0 })
    })

    it("updates existing instances with server metadata while preserving runtime state", () => {
      // Set up an instance with runtime state
      useAppStore.getState().createInstance("existing-instance", "Old Name", "Old Agent")
      const state = useAppStore.getState()
      const instance = state.instances.get("existing-instance")!
      const updatedInstances = new Map(state.instances)
      updatedInstances.set("existing-instance", {
        ...instance,
        events: [{ type: "test", timestamp: 123 }],
        tokenUsage: { input: 1000, output: 500 },
        contextWindow: { used: 50000, max: 200000 },
      })
      useAppStore.setState({ instances: updatedInstances })

      // Hydrate with server data
      useAppStore.getState().hydrateInstances([
        {
          id: "existing-instance",
          name: "Updated Name",
          agentName: "Updated Agent",
          worktreePath: "/new/path",
          branch: "feature/new",
          createdAt: 1700000000000,
          currentTaskId: "new-task",
          currentTaskTitle: "New task title",
          status: "running",
          mergeConflict: null,
        },
      ])

      const updatedInstance = useAppStore.getState().instances.get("existing-instance")!
      // Metadata should be updated
      expect(updatedInstance.name).toBe("Updated Name")
      expect(updatedInstance.agentName).toBe("Updated Agent")
      expect(updatedInstance.worktreePath).toBe("/new/path")
      expect(updatedInstance.branch).toBe("feature/new")
      expect(updatedInstance.status).toBe("running")
      expect(updatedInstance.currentTaskId).toBe("new-task")
      // Runtime state should be preserved
      expect(updatedInstance.events).toHaveLength(1)
      expect(updatedInstance.tokenUsage).toEqual({ input: 1000, output: 500 })
      expect(updatedInstance.contextWindow.used).toBe(50000)
    })

    it("preserves activeInstanceId if it still exists after hydration", () => {
      useAppStore.getState().createInstance("my-active-instance", "Active")
      useAppStore.getState().setActiveInstanceId("my-active-instance")

      useAppStore.getState().hydrateInstances([
        {
          id: "my-active-instance",
          name: "Updated Active",
          agentName: "Ralph",
          worktreePath: null,
          branch: null,
          createdAt: Date.now(),
          currentTaskId: null,
          currentTaskTitle: null,
          status: "stopped",
          mergeConflict: null,
        },
        {
          id: "other-instance",
          name: "Other",
          agentName: "Ralph-2",
          worktreePath: null,
          branch: null,
          createdAt: Date.now(),
          currentTaskId: null,
          currentTaskTitle: null,
          status: "stopped",
          mergeConflict: null,
        },
      ])

      expect(useAppStore.getState().activeInstanceId).toBe("my-active-instance")
    })

    it("switches to first server instance if active instance becomes invalid", () => {
      // Start with only the default instance
      const state = useAppStore.getState()
      expect(state.activeInstanceId).toBe(DEFAULT_INSTANCE_ID)

      // Hydrate with a completely different set of instances
      // The default instance doesn't exist in server data, but the store keeps local instances
      // This test verifies that if the active instance doesn't exist in the result, it falls back
      useAppStore.setState({ activeInstanceId: "non-existent-instance" })

      useAppStore.getState().hydrateInstances([
        {
          id: "server-instance",
          name: "Server",
          agentName: "Ralph",
          worktreePath: null,
          branch: null,
          createdAt: Date.now(),
          currentTaskId: null,
          currentTaskTitle: null,
          status: "stopped",
          mergeConflict: null,
        },
      ])

      // Since non-existent-instance is not in the merged instances, it should switch to server-instance
      expect(useAppStore.getState().activeInstanceId).toBe("server-instance")
    })

    it("does nothing with empty instances array", () => {
      const initialState = useAppStore.getState()
      const initialCount = initialState.instances.size

      useAppStore.getState().hydrateInstances([])

      expect(useAppStore.getState().instances.size).toBe(initialCount)
    })

    it("syncs flat fields when active instance is updated", () => {
      useAppStore.getState().createInstance("active", "Active Instance")
      useAppStore.getState().setActiveInstanceId("active")

      useAppStore.getState().hydrateInstances([
        {
          id: "active",
          name: "Updated Active",
          agentName: "Ralph-Updated",
          worktreePath: "/worktree",
          branch: "main",
          createdAt: 1700000000000,
          currentTaskId: "task-1",
          currentTaskTitle: "Task 1",
          status: "running",
          mergeConflict: null,
        },
      ])

      const state = useAppStore.getState()
      // Flat fields should be synced from the updated active instance
      expect(state.ralphStatus).toBe("running")
    })
  })

  describe("flat field delegation to active instance", () => {
    it("setRalphStatus updates active instance status", () => {
      useAppStore.getState().setRalphStatus("running")
      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.status).toBe("running")
    })

    it("setRalphStatus updates active instance runStartedAt when transitioning to running", () => {
      const before = Date.now()
      useAppStore.getState().setRalphStatus("running")
      const after = Date.now()

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.runStartedAt).toBeGreaterThanOrEqual(before)
      expect(activeInstance?.runStartedAt).toBeLessThanOrEqual(after)
    })

    it("setRalphStatus clears active instance runStartedAt when stopped", () => {
      useAppStore.getState().setRalphStatus("running")
      let state = useAppStore.getState()
      expect(state.instances.get(state.activeInstanceId)?.runStartedAt).not.toBeNull()

      useAppStore.getState().setRalphStatus("stopped")
      state = useAppStore.getState()
      expect(state.instances.get(state.activeInstanceId)?.runStartedAt).toBeNull()
    })

    it("addEvent updates active instance events", () => {
      const event = { type: "test", timestamp: 12345 }
      useAppStore.getState().addEvent(event)

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.events).toHaveLength(1)
      expect(activeInstance?.events[0]).toEqual(event)
    })

    it("setEvents updates active instance events", () => {
      const events = [
        { type: "first", timestamp: 1 },
        { type: "second", timestamp: 2 },
      ]
      useAppStore.getState().setEvents(events)

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.events).toHaveLength(2)
      expect(activeInstance?.events).toEqual(events)
    })

    it("clearEvents clears active instance events", () => {
      useAppStore.getState().addEvent({ type: "test", timestamp: 1 })
      let state = useAppStore.getState()
      expect(state.instances.get(state.activeInstanceId)?.events).toHaveLength(1)

      useAppStore.getState().clearEvents()
      state = useAppStore.getState()
      expect(state.instances.get(state.activeInstanceId)?.events).toEqual([])
    })

    it("setTokenUsage updates active instance tokenUsage", () => {
      const usage = { input: 1000, output: 500 }
      useAppStore.getState().setTokenUsage(usage)

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.tokenUsage).toEqual(usage)
    })

    it("addTokenUsage updates active instance tokenUsage", () => {
      useAppStore.getState().addTokenUsage({ input: 100, output: 50 })
      useAppStore.getState().addTokenUsage({ input: 200, output: 100 })

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.tokenUsage).toEqual({ input: 300, output: 150 })
    })

    it("setContextWindow updates active instance contextWindow", () => {
      const contextWindow = { used: 50000, max: 200000 }
      useAppStore.getState().setContextWindow(contextWindow)

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.contextWindow).toEqual(contextWindow)
    })

    it("updateContextWindowUsed updates active instance contextWindow", () => {
      useAppStore.getState().updateContextWindowUsed(75000)

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.contextWindow.used).toBe(75000)
    })

    it("setSession updates active instance session", () => {
      const session = { current: 3, total: 10 }
      useAppStore.getState().setSession(session)

      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.session).toEqual(session)
    })

    it("resetSessionStats resets token usage, context window, and session to defaults", () => {
      // Set up various state that should be reset
      useAppStore.getState().setTokenUsage({ input: 5000, output: 2500 })
      useAppStore.getState().setContextWindow({ used: 100000, max: 200000 })
      useAppStore.getState().setSession({ current: 7, total: 15 })

      // Verify state was set
      let state = useAppStore.getState()
      expect(state.tokenUsage).toEqual({ input: 5000, output: 2500 })
      expect(state.contextWindow).toEqual({ used: 100000, max: 200000 })
      expect(state.session).toEqual({ current: 7, total: 15 })

      // Reset session stats
      useAppStore.getState().resetSessionStats()

      // Verify all session stats were reset
      state = useAppStore.getState()
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(state.contextWindow).toEqual({ used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX })
      expect(state.session).toEqual({ current: 0, total: 0 })
    })

    it("resetSessionStats updates active instance in the instances Map", () => {
      // Set up state on the active instance
      useAppStore.getState().setTokenUsage({ input: 3000, output: 1500 })
      useAppStore.getState().setContextWindow({ used: 75000, max: 200000 })
      useAppStore.getState().setSession({ current: 4, total: 8 })

      // Reset session stats
      useAppStore.getState().resetSessionStats()

      // Verify the active instance in the Map was also updated
      const state = useAppStore.getState()
      const activeInstance = state.instances.get(state.activeInstanceId)
      expect(activeInstance?.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(activeInstance?.contextWindow).toEqual({ used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX })
      expect(activeInstance?.session).toEqual({ current: 0, total: 0 })
    })

    it("clearWorkspaceData resets active instance state", () => {
      // Set up various state
      useAppStore.getState().setRalphStatus("running")
      useAppStore.getState().addEvent({ type: "test", timestamp: 1 })
      useAppStore.getState().setTokenUsage({ input: 1000, output: 500 })
      useAppStore.getState().setSession({ current: 5, total: 10 })

      // Verify state was set
      let state = useAppStore.getState()
      let instance = state.instances.get(state.activeInstanceId)
      expect(instance?.status).toBe("running")
      expect(instance?.events).toHaveLength(1)
      expect(instance?.tokenUsage.input).toBe(1000)

      // Clear workspace data
      useAppStore.getState().clearWorkspaceData()

      // Verify instance was reset
      state = useAppStore.getState()
      instance = state.instances.get(state.activeInstanceId)
      expect(instance?.status).toBe("stopped")
      expect(instance?.events).toEqual([])
      expect(instance?.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(instance?.contextWindow).toEqual({ used: 0, max: 200_000 })
      expect(instance?.session).toEqual({ current: 0, total: 0 })
      expect(instance?.runStartedAt).toBeNull()
    })
  })

  describe("delegating selectors read from active instance", () => {
    it("selectRalphStatus reads from active instance", () => {
      useAppStore.getState().setRalphStatus("running")
      const state = useAppStore.getState()
      expect(selectRalphStatus(state)).toBe("running")
      // Verify it matches the instance
      expect(selectRalphStatus(state)).toBe(state.instances.get(state.activeInstanceId)?.status)
    })

    it("selectRunStartedAt reads from active instance", () => {
      useAppStore.getState().setRalphStatus("running")
      const state = useAppStore.getState()
      const runStartedAt = selectRunStartedAt(state)
      expect(runStartedAt).not.toBeNull()
      expect(runStartedAt).toBe(state.instances.get(state.activeInstanceId)?.runStartedAt)
    })

    it("selectEvents reads from active instance", () => {
      const events = [
        { type: "first", timestamp: 1 },
        { type: "second", timestamp: 2 },
      ]
      useAppStore.getState().setEvents(events)
      const state = useAppStore.getState()
      expect(selectEvents(state)).toEqual(events)
      expect(selectEvents(state)).toBe(state.instances.get(state.activeInstanceId)?.events)
    })

    it("selectTokenUsage reads from active instance", () => {
      const usage = { input: 1000, output: 500 }
      useAppStore.getState().setTokenUsage(usage)
      const state = useAppStore.getState()
      expect(selectTokenUsage(state)).toEqual(usage)
      expect(selectTokenUsage(state)).toBe(state.instances.get(state.activeInstanceId)?.tokenUsage)
    })

    it("selectContextWindow reads from active instance", () => {
      const contextWindow = { used: 50000, max: 200000 }
      useAppStore.getState().setContextWindow(contextWindow)
      const state = useAppStore.getState()
      expect(selectContextWindow(state)).toEqual(contextWindow)
      expect(selectContextWindow(state)).toBe(
        state.instances.get(state.activeInstanceId)?.contextWindow,
      )
    })

    it("selectSession reads from active instance", () => {
      const session = { current: 5, total: 10 }
      useAppStore.getState().setSession(session)
      const state = useAppStore.getState()
      expect(selectSession(state)).toEqual(session)
      expect(selectSession(state)).toBe(state.instances.get(state.activeInstanceId)?.session)
    })
  })

  describe("ralph status", () => {
    it("sets ralph status", () => {
      useAppStore.getState().setRalphStatus("running")
      expect(useAppStore.getState().ralphStatus).toBe("running")
    })

    it("updates through all status transitions", () => {
      const { setRalphStatus } = useAppStore.getState()

      setRalphStatus("starting")
      expect(useAppStore.getState().ralphStatus).toBe("starting")

      setRalphStatus("running")
      expect(useAppStore.getState().ralphStatus).toBe("running")

      setRalphStatus("stopping")
      expect(useAppStore.getState().ralphStatus).toBe("stopping")

      setRalphStatus("stopped")
      expect(useAppStore.getState().ralphStatus).toBe("stopped")
    })

    it("sets initialTaskCount when transitioning to running", () => {
      // Set up some tasks before running
      useAppStore.getState().setTasks([
        { id: "1", title: "Task 1", status: "open" },
        { id: "2", title: "Task 2", status: "closed" },
        { id: "3", title: "Task 3", status: "in_progress" },
      ])

      // Initially null
      expect(useAppStore.getState().initialTaskCount).toBeNull()

      // Transition to running
      useAppStore.getState().setRalphStatus("running")

      // Should capture initial task count
      expect(useAppStore.getState().initialTaskCount).toBe(3)
    })

    it("clears initialTaskCount when transitioning to stopped", () => {
      // Set up and start
      useAppStore.getState().setTasks([{ id: "1", title: "Task 1", status: "open" }])
      useAppStore.getState().setRalphStatus("running")
      expect(useAppStore.getState().initialTaskCount).toBe(1)

      // Stop
      useAppStore.getState().setRalphStatus("stopped")
      expect(useAppStore.getState().initialTaskCount).toBeNull()
    })

    it("preserves initialTaskCount during paused/stopping_after_current states", () => {
      // Set up and start
      useAppStore.getState().setTasks([
        { id: "1", title: "Task 1", status: "open" },
        { id: "2", title: "Task 2", status: "open" },
      ])
      useAppStore.getState().setRalphStatus("running")
      expect(useAppStore.getState().initialTaskCount).toBe(2)

      // Pause - should preserve
      useAppStore.getState().setRalphStatus("paused")
      expect(useAppStore.getState().initialTaskCount).toBe(2)

      // Stop after current - should preserve
      useAppStore.getState().setRalphStatus("stopping_after_current")
      expect(useAppStore.getState().initialTaskCount).toBe(2)
    })

    it("does not update initialTaskCount when already running", () => {
      // Start with 2 tasks
      useAppStore.getState().setTasks([
        { id: "1", title: "Task 1", status: "open" },
        { id: "2", title: "Task 2", status: "open" },
      ])
      useAppStore.getState().setRalphStatus("running")
      expect(useAppStore.getState().initialTaskCount).toBe(2)

      // Add more tasks
      useAppStore.getState().setTasks([
        { id: "1", title: "Task 1", status: "open" },
        { id: "2", title: "Task 2", status: "open" },
        { id: "3", title: "Task 3", status: "open" },
      ])

      // Set running again (shouldn't change initial count)
      useAppStore.getState().setRalphStatus("running")
      expect(useAppStore.getState().initialTaskCount).toBe(2)
    })
  })

  describe("selectCanAcceptMessages", () => {
    it("returns true when running", () => {
      useAppStore.getState().setRalphStatus("running")
      expect(selectCanAcceptMessages(useAppStore.getState())).toBe(true)
    })

    it("returns true when paused", () => {
      useAppStore.getState().setRalphStatus("paused")
      expect(selectCanAcceptMessages(useAppStore.getState())).toBe(true)
    })

    it("returns true when stopping_after_current", () => {
      useAppStore.getState().setRalphStatus("stopping_after_current")
      expect(selectCanAcceptMessages(useAppStore.getState())).toBe(true)
    })

    it("returns false when stopped", () => {
      useAppStore.getState().setRalphStatus("stopped")
      expect(selectCanAcceptMessages(useAppStore.getState())).toBe(false)
    })

    it("returns false when starting", () => {
      useAppStore.getState().setRalphStatus("starting")
      expect(selectCanAcceptMessages(useAppStore.getState())).toBe(false)
    })

    it("returns false when stopping", () => {
      useAppStore.getState().setRalphStatus("stopping")
      expect(selectCanAcceptMessages(useAppStore.getState())).toBe(false)
    })
  })

  describe("events", () => {
    it("adds events to the list", () => {
      const event: ChatEvent = { type: "test", timestamp: 1234567890 }
      useAppStore.getState().addEvent(event)

      const events = useAppStore.getState().events
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(event)
    })

    it("preserves event order", () => {
      const { addEvent } = useAppStore.getState()

      addEvent({ type: "first", timestamp: 1 })
      addEvent({ type: "second", timestamp: 2 })
      addEvent({ type: "third", timestamp: 3 })

      const events = useAppStore.getState().events
      expect(events).toHaveLength(3)
      expect(events[0].type).toBe("first")
      expect(events[1].type).toBe("second")
      expect(events[2].type).toBe("third")
    })

    it("clears all events", () => {
      const { addEvent, clearEvents } = useAppStore.getState()

      addEvent({ type: "test", timestamp: 1 })
      addEvent({ type: "test", timestamp: 2 })
      expect(useAppStore.getState().events).toHaveLength(2)

      clearEvents()
      expect(useAppStore.getState().events).toEqual([])
    })

    it("sets events array directly (for restoring from server)", () => {
      const events: ChatEvent[] = [
        { type: "first", timestamp: 1 },
        { type: "second", timestamp: 2 },
        { type: "third", timestamp: 3 },
      ]

      useAppStore.getState().setEvents(events)

      const storedEvents = useAppStore.getState().events
      expect(storedEvents).toHaveLength(3)
      expect(storedEvents).toEqual(events)
    })

    it("setEvents replaces existing events", () => {
      // Add initial events
      useAppStore.getState().addEvent({ type: "old", timestamp: 1 })
      expect(useAppStore.getState().events).toHaveLength(1)

      // Set new events (should replace)
      const newEvents: ChatEvent[] = [
        { type: "new1", timestamp: 2 },
        { type: "new2", timestamp: 3 },
      ]
      useAppStore.getState().setEvents(newEvents)

      const storedEvents = useAppStore.getState().events
      expect(storedEvents).toHaveLength(2)
      expect(storedEvents[0].type).toBe("new1")
      expect(storedEvents[1].type).toBe("new2")
    })
  })

  describe("tasks", () => {
    const sampleTasks: Task[] = [
      { id: "1", title: "Task 1", status: "open" },
      { id: "2", title: "Task 2", status: "in_progress" },
      { id: "3", title: "Task 3", status: "closed" },
    ]

    it("sets tasks", () => {
      useAppStore.getState().setTasks(sampleTasks)

      const tasks = useAppStore.getState().tasks
      expect(tasks).toHaveLength(3)
      expect(tasks).toEqual(sampleTasks)
    })

    it("updates a specific task", () => {
      useAppStore.getState().setTasks(sampleTasks)
      useAppStore.getState().updateTask("2", { status: "closed" })

      const tasks = useAppStore.getState().tasks
      const updatedTask = tasks.find(t => t.id === "2")
      expect(updatedTask?.status).toBe("closed")
    })

    it("updates task title", () => {
      useAppStore.getState().setTasks(sampleTasks)
      useAppStore.getState().updateTask("1", { title: "Updated title" })

      const tasks = useAppStore.getState().tasks
      const updatedTask = tasks.find(t => t.id === "1")
      expect(updatedTask?.title).toBe("Updated title")
    })

    it("does not modify other tasks when updating", () => {
      useAppStore.getState().setTasks(sampleTasks)
      useAppStore.getState().updateTask("2", { status: "closed" })

      const tasks = useAppStore.getState().tasks
      expect(tasks.find(t => t.id === "1")?.status).toBe("open")
      expect(tasks.find(t => t.id === "3")?.status).toBe("closed")
    })

    it("clears all tasks", () => {
      useAppStore.getState().setTasks(sampleTasks)
      expect(useAppStore.getState().tasks).toHaveLength(3)

      useAppStore.getState().clearTasks()
      expect(useAppStore.getState().tasks).toEqual([])
    })

    describe("selectCurrentTask", () => {
      it("returns task with in_progress status", () => {
        useAppStore.getState().setTasks(sampleTasks)
        const currentTask = selectCurrentTask(useAppStore.getState())
        expect(currentTask).not.toBeNull()
        expect(currentTask?.id).toBe("2")
        expect(currentTask?.status).toBe("in_progress")
      })

      it("returns null when no task is in progress", () => {
        const tasksWithoutInProgress: Task[] = [
          { id: "1", title: "Task 1", status: "open" },
          { id: "2", title: "Task 2", status: "closed" },
        ]
        useAppStore.getState().setTasks(tasksWithoutInProgress)
        const currentTask = selectCurrentTask(useAppStore.getState())
        expect(currentTask).toBeNull()
      })

      it("returns null when tasks are empty", () => {
        useAppStore.getState().setTasks([])
        const currentTask = selectCurrentTask(useAppStore.getState())
        expect(currentTask).toBeNull()
      })

      it("returns first in_progress task when multiple exist", () => {
        const tasksWithMultipleInProgress: Task[] = [
          { id: "1", title: "Task 1", status: "in_progress" },
          { id: "2", title: "Task 2", status: "in_progress" },
        ]
        useAppStore.getState().setTasks(tasksWithMultipleInProgress)
        const currentTask = selectCurrentTask(useAppStore.getState())
        expect(currentTask?.id).toBe("1")
      })
    })
  })

  describe("workspace", () => {
    it("sets workspace path", () => {
      useAppStore.getState().setWorkspace("/path/to/project")
      expect(useAppStore.getState().workspace).toBe("/path/to/project")
    })

    it("clears workspace", () => {
      useAppStore.getState().setWorkspace("/path/to/project")
      useAppStore.getState().setWorkspace(null)
      expect(useAppStore.getState().workspace).toBeNull()
    })

    it("clears all workspace-specific data", () => {
      // Set up various workspace-specific state
      const {
        addEvent,
        setTasks,
        setTokenUsage,
        setSession,
        addTaskChatMessage,
        addTaskChatEvent,
      } = useAppStore.getState()
      addEvent({ type: "test", timestamp: 123 })
      setTasks([{ id: "1", title: "Task 1", status: "open" }])
      setTokenUsage({ input: 100, output: 50 })
      setSession({ current: 2, total: 5 })
      addTaskChatMessage({ id: "msg-1", role: "user", content: "Hello", timestamp: 123 })
      addTaskChatEvent({ type: "stream_event", timestamp: 456, event: {} })
      flushTaskChatEventsBatch() // Flush batch to apply events immediately
      useAppStore.getState().setViewingSessionIndex(1)

      // Verify state was set
      expect(useAppStore.getState().events).toHaveLength(1)
      expect(useAppStore.getState().tasks).toHaveLength(1)
      expect(useAppStore.getState().tokenUsage.input).toBe(100)
      expect(useAppStore.getState().session.current).toBe(2)
      expect(useAppStore.getState().taskChatMessages).toHaveLength(1)
      expect(useAppStore.getState().taskChatEvents).toHaveLength(1)
      expect(useAppStore.getState().viewingSessionIndex).toBe(1)

      // Clear workspace data
      useAppStore.getState().clearWorkspaceData()

      // Verify all workspace-specific state was cleared
      expect(useAppStore.getState().events).toEqual([])
      expect(useAppStore.getState().tasks).toEqual([])
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 0, output: 0 })
      expect(useAppStore.getState().session).toEqual({ current: 0, total: 0 })
      expect(useAppStore.getState().taskChatMessages).toEqual([])
      expect(useAppStore.getState().taskChatEvents).toEqual([])
      expect(useAppStore.getState().viewingSessionIndex).toBeNull()
    })
  })

  describe("accent color", () => {
    it("sets accent color", () => {
      useAppStore.getState().setAccentColor("#4d9697")
      expect(useAppStore.getState().accentColor).toBe("#4d9697")
    })

    it("clears accent color", () => {
      useAppStore.getState().setAccentColor("#4d9697")
      useAppStore.getState().setAccentColor(null)
      expect(useAppStore.getState().accentColor).toBeNull()
    })
  })

  describe("branch", () => {
    it("sets branch name", () => {
      useAppStore.getState().setBranch("feature/new-feature")
      expect(useAppStore.getState().branch).toBe("feature/new-feature")
    })

    it("clears branch", () => {
      useAppStore.getState().setBranch("main")
      useAppStore.getState().setBranch(null)
      expect(useAppStore.getState().branch).toBeNull()
    })
  })

  describe("token usage", () => {
    it("sets token usage", () => {
      useAppStore.getState().setTokenUsage({ input: 1000, output: 500 })
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 1000, output: 500 })
    })

    it("adds to token usage", () => {
      useAppStore.getState().setTokenUsage({ input: 1000, output: 500 })
      useAppStore.getState().addTokenUsage({ input: 200, output: 100 })
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 1200, output: 600 })
    })

    it("accumulates multiple token additions", () => {
      useAppStore.getState().addTokenUsage({ input: 100, output: 50 })
      useAppStore.getState().addTokenUsage({ input: 200, output: 100 })
      useAppStore.getState().addTokenUsage({ input: 300, output: 150 })
      expect(useAppStore.getState().tokenUsage).toEqual({ input: 600, output: 300 })
    })
  })

  describe("context window", () => {
    it("has default max context window of 200k", () => {
      expect(useAppStore.getState().contextWindow).toEqual({ used: 0, max: 200_000 })
    })

    it("sets context window", () => {
      useAppStore.getState().setContextWindow({ used: 50000, max: 200000 })
      expect(useAppStore.getState().contextWindow).toEqual({ used: 50000, max: 200000 })
    })

    it("updates context window used", () => {
      useAppStore.getState().updateContextWindowUsed(75000)
      expect(useAppStore.getState().contextWindow).toEqual({ used: 75000, max: 200_000 })
    })

    it("preserves max when updating used", () => {
      useAppStore.getState().setContextWindow({ used: 0, max: 150000 })
      useAppStore.getState().updateContextWindowUsed(50000)
      expect(useAppStore.getState().contextWindow).toEqual({ used: 50000, max: 150000 })
    })
  })

  describe("session", () => {
    it("sets session info", () => {
      useAppStore.getState().setSession({ current: 3, total: 10 })
      expect(useAppStore.getState().session).toEqual({ current: 3, total: 10 })
    })

    it("updates session progress", () => {
      useAppStore.getState().setSession({ current: 1, total: 5 })
      useAppStore.getState().setSession({ current: 2, total: 5 })
      expect(useAppStore.getState().session).toEqual({ current: 2, total: 5 })
    })
  })

  describe("session view", () => {
    // Helper to create events with session boundaries
    const createEventsWithSessions = (): ChatEvent[] => [
      { type: "system", subtype: "init", timestamp: 1000 } as ChatEvent,
      { type: "assistant", timestamp: 1001 } as ChatEvent,
      { type: "user_message", timestamp: 1002 } as ChatEvent,
      { type: "system", subtype: "init", timestamp: 2000 } as ChatEvent,
      { type: "assistant", timestamp: 2001 } as ChatEvent,
      { type: "system", subtype: "init", timestamp: 3000 } as ChatEvent,
      { type: "user_message", timestamp: 3001 } as ChatEvent,
      { type: "assistant", timestamp: 3002 } as ChatEvent,
    ]

    describe("isSessionBoundary", () => {
      it("returns true for system init events", () => {
        const event = { type: "system", subtype: "init", timestamp: 1000 } as ChatEvent
        expect(isSessionBoundary(event)).toBe(true)
      })

      it("returns false for other events", () => {
        expect(isSessionBoundary({ type: "assistant", timestamp: 1000 } as ChatEvent)).toBe(false)
        expect(isSessionBoundary({ type: "user_message", timestamp: 1000 } as ChatEvent)).toBe(
          false,
        )
        expect(
          isSessionBoundary({ type: "system", subtype: "other", timestamp: 1000 } as ChatEvent),
        ).toBe(false)
      })
    })

    describe("getSessionBoundaries", () => {
      it("returns empty array for no events", () => {
        expect(getSessionBoundaries([])).toEqual([])
      })

      it("returns indices of all session boundaries", () => {
        const events = createEventsWithSessions()
        expect(getSessionBoundaries(events)).toEqual([0, 3, 5])
      })

      it("returns empty array when no boundaries exist", () => {
        const events = [
          { type: "assistant", timestamp: 1000 },
          { type: "user_message", timestamp: 1001 },
        ] as ChatEvent[]
        expect(getSessionBoundaries(events)).toEqual([])
      })
    })

    describe("countSessions", () => {
      it("returns 0 for no events", () => {
        expect(countSessions([])).toBe(0)
      })

      it("counts session boundaries", () => {
        const events = createEventsWithSessions()
        expect(countSessions(events)).toBe(3)
      })
    })

    describe("getEventsForSession", () => {
      it("returns all events when index is null and no boundaries", () => {
        const events = [
          { type: "assistant", timestamp: 1000 },
          { type: "user_message", timestamp: 1001 },
        ] as ChatEvent[]
        expect(getEventsForSession(events, null)).toEqual(events)
      })

      it("returns events from latest session when index is null", () => {
        const events = createEventsWithSessions()
        const result = getEventsForSession(events, null)
        expect(result).toHaveLength(3) // 3rd session has 3 events
        expect(result[0].timestamp).toBe(3000)
      })

      it("returns events for specific session index", () => {
        const events = createEventsWithSessions()

        // First session (index 0): 3 events
        const first = getEventsForSession(events, 0)
        expect(first).toHaveLength(3)
        expect(first[0].timestamp).toBe(1000)
        expect(first[2].timestamp).toBe(1002)

        // Second session (index 1): 2 events
        const second = getEventsForSession(events, 1)
        expect(second).toHaveLength(2)
        expect(second[0].timestamp).toBe(2000)

        // Third session (index 2): 3 events
        const third = getEventsForSession(events, 2)
        expect(third).toHaveLength(3)
        expect(third[0].timestamp).toBe(3000)
      })

      it("returns all events for out-of-bounds index", () => {
        const events = createEventsWithSessions()
        expect(getEventsForSession(events, -1)).toEqual(events)
        expect(getEventsForSession(events, 10)).toEqual(events)
      })
    })

    describe("getTaskFromSessionEvents", () => {
      it("returns null when no ralph_task_started events exist", () => {
        const events = [
          { type: "assistant", timestamp: 1000 },
          { type: "user_message", timestamp: 1001 },
        ] as ChatEvent[]
        expect(getTaskFromSessionEvents(events)).toBeNull()
      })

      it("extracts task from ralph_task_started event", () => {
        const events = [
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 1001,
            taskId: "rui-123",
            taskTitle: "Fix the bug",
          },
          { type: "assistant", timestamp: 1002 },
        ] as ChatEvent[]
        const task = getTaskFromSessionEvents(events)
        expect(task).toEqual({ id: "rui-123", title: "Fix the bug" })
      })

      it("returns task with ID as title if ralph_task_started event has taskId but no taskTitle", () => {
        const events = [
          { type: "ralph_task_started", timestamp: 1000, taskId: "rui-123" },
        ] as ChatEvent[]
        expect(getTaskFromSessionEvents(events)).toEqual({ id: "rui-123", title: "rui-123" })
      })

      it("returns null if ralph_task_started event is missing both taskId and taskTitle", () => {
        const events = [{ type: "ralph_task_started", timestamp: 1000 }] as ChatEvent[]
        expect(getTaskFromSessionEvents(events)).toBeNull()
      })

      it("returns the first task when multiple ralph_task_started events exist", () => {
        const events = [
          {
            type: "ralph_task_started",
            timestamp: 1000,
            taskId: "rui-111",
            taskTitle: "First task",
          },
          {
            type: "ralph_task_started",
            timestamp: 1001,
            taskId: "rui-222",
            taskTitle: "Second task",
          },
        ] as ChatEvent[]
        const task = getTaskFromSessionEvents(events)
        expect(task).toEqual({ id: "rui-111", title: "First task" })
      })

      // Fallback tests - parsing from assistant message text
      it("extracts task from <start_task> tag in assistant message when no ralph_task_started event", () => {
        const events = [
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "assistant",
            timestamp: 1001,
            message: {
              content: [{ type: "text", text: "<start_task>rui-123</start_task>" }],
            },
          },
        ] as ChatEvent[]
        const task = getTaskFromSessionEvents(events)
        expect(task).toEqual({ id: "rui-123", title: "rui-123" })
      })

      it("extracts task from emoji format in assistant message when no ralph_task_started event", () => {
        const events = [
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "assistant",
            timestamp: 1001,
            message: {
              content: [{ type: "text", text: "✨ Starting **rui-456 Fix the button layout**" }],
            },
          },
        ] as ChatEvent[]
        const task = getTaskFromSessionEvents(events)
        expect(task).toEqual({ id: "rui-456", title: "Fix the button layout" })
      })

      it("prefers ralph_task_started event over assistant message text", () => {
        const events = [
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 1001,
            taskId: "rui-111",
            taskTitle: "From event",
          },
          {
            type: "assistant",
            timestamp: 1002,
            message: {
              content: [{ type: "text", text: "✨ Starting **rui-222 From text**" }],
            },
          },
        ] as ChatEvent[]
        const task = getTaskFromSessionEvents(events)
        expect(task).toEqual({ id: "rui-111", title: "From event" })
      })

      it("returns null when assistant message has no task lifecycle event", () => {
        const events = [
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "assistant",
            timestamp: 1001,
            message: {
              content: [{ type: "text", text: "Just a normal message without task info" }],
            },
          },
        ] as ChatEvent[]
        expect(getTaskFromSessionEvents(events)).toBeNull()
      })
    })

    describe("getSessionTaskInfos", () => {
      it("returns empty array when no events", () => {
        expect(getSessionTaskInfos([])).toEqual([])
      })

      it("returns empty array when no session boundaries", () => {
        const events = [
          { type: "assistant", timestamp: 1000 },
          { type: "user_message", timestamp: 1001 },
        ] as ChatEvent[]
        expect(getSessionTaskInfos(events)).toEqual([])
      })

      it("returns task info for each session", () => {
        const events = [
          // First session
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 1001,
            taskId: "rui-111",
            taskTitle: "First task",
          },
          { type: "assistant", timestamp: 1002 },
          // Second session
          { type: "system", timestamp: 2000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 2001,
            taskId: "rui-222",
            taskTitle: "Second task",
          },
          { type: "assistant", timestamp: 2002 },
          // Third session
          { type: "system", timestamp: 3000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 3001,
            taskId: "rui-333",
            taskTitle: "Third task",
          },
        ] as ChatEvent[]
        expect(getSessionTaskInfos(events)).toEqual([
          { id: "rui-111", title: "First task" },
          { id: "rui-222", title: "Second task" },
          { id: "rui-333", title: "Third task" },
        ])
      })

      it("returns null values for sessions without tasks", () => {
        const events = [
          // First session - has task
          { type: "system", timestamp: 1000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 1001,
            taskId: "rui-111",
            taskTitle: "First task",
          },
          // Second session - no task
          { type: "system", timestamp: 2000, subtype: "init" },
          { type: "assistant", timestamp: 2001 },
          // Third session - has task
          { type: "system", timestamp: 3000, subtype: "init" },
          {
            type: "ralph_task_started",
            timestamp: 3001,
            taskId: "rui-333",
            taskTitle: "Third task",
          },
        ] as ChatEvent[]
        expect(getSessionTaskInfos(events)).toEqual([
          { id: "rui-111", title: "First task" },
          { id: null, title: null },
          { id: "rui-333", title: "Third task" },
        ])
      })
    })

    describe("selectSessionTask", () => {
      it("returns null when no events", () => {
        const task = selectSessionTask(useAppStore.getState())
        expect(task).toBeNull()
      })

      it("returns task from latest session by default", () => {
        useAppStore.getState().addEvent({
          type: "system",
          timestamp: 1000,
          subtype: "init",
        })
        useAppStore.getState().addEvent({
          type: "ralph_task_started",
          timestamp: 1001,
          taskId: "rui-999",
          taskTitle: "Latest task",
        })
        const task = selectSessionTask(useAppStore.getState())
        expect(task).toEqual({ id: "rui-999", title: "Latest task" })
      })

      it("returns task from specific session when viewingSessionIndex is set", () => {
        // First session
        useAppStore.getState().addEvent({
          type: "system",
          timestamp: 1000,
          subtype: "init",
        })
        useAppStore.getState().addEvent({
          type: "ralph_task_started",
          timestamp: 1001,
          taskId: "rui-111",
          taskTitle: "First task",
        })

        // Second session
        useAppStore.getState().addEvent({
          type: "system",
          timestamp: 2000,
          subtype: "init",
        })
        useAppStore.getState().addEvent({
          type: "ralph_task_started",
          timestamp: 2001,
          taskId: "rui-222",
          taskTitle: "Second task",
        })

        // View first session
        useAppStore.getState().setViewingSessionIndex(0)

        const task = selectSessionTask(useAppStore.getState())
        expect(task).toEqual({ id: "rui-111", title: "First task" })
      })

      it("falls back to instance currentTaskId/currentTaskTitle when no events", () => {
        // Simulate page reload scenario where server sends instance info
        // with currentTaskId/currentTaskTitle but events don't include ralph_task_started
        useAppStore.getState().hydrateInstances([
          {
            id: DEFAULT_INSTANCE_ID,
            name: "Default",
            agentName: "Ralph",
            status: "running",
            worktreePath: null,
            branch: null,
            currentTaskId: "rui-restored",
            currentTaskTitle: "Restored task from server",
            createdAt: Date.now(),
            mergeConflict: null,
          },
        ])

        const task = selectSessionTask(useAppStore.getState())
        expect(task).toEqual({ id: "rui-restored", title: "Restored task from server" })
      })

      it("falls back to instance with only currentTaskTitle (no currentTaskId)", () => {
        // Simulate scenario where task doesn't have an ID but has a title
        useAppStore.getState().hydrateInstances([
          {
            id: DEFAULT_INSTANCE_ID,
            name: "Default",
            agentName: "Ralph",
            status: "running",
            worktreePath: null,
            branch: null,
            currentTaskId: null,
            currentTaskTitle: "Ad-hoc task without ID",
            createdAt: Date.now(),
            mergeConflict: null,
          },
        ])

        const task = selectSessionTask(useAppStore.getState())
        expect(task).toEqual({ id: null, title: "Ad-hoc task without ID" })
      })

      it("prefers event task over instance fallback", () => {
        // Set up instance with current task info
        useAppStore.getState().hydrateInstances([
          {
            id: DEFAULT_INSTANCE_ID,
            name: "Default",
            agentName: "Ralph",
            status: "running",
            worktreePath: null,
            branch: null,
            currentTaskId: "rui-instance",
            currentTaskTitle: "Task from instance",
            createdAt: Date.now(),
            mergeConflict: null,
          },
        ])

        // Add a ralph_task_started event for a DIFFERENT task
        useAppStore.getState().addEvent({
          type: "ralph_task_started",
          timestamp: 1001,
          taskId: "rui-event",
          taskTitle: "Task from event",
        })

        const task = selectSessionTask(useAppStore.getState())
        expect(task).toEqual({ id: "rui-event", title: "Task from event" })
      })
    })

    describe("session navigation actions", () => {
      beforeEach(() => {
        const events = createEventsWithSessions()
        events.forEach(e => useAppStore.getState().addEvent(e))
      })

      it("has null viewingSessionIndex initially (latest)", () => {
        expect(useAppStore.getState().viewingSessionIndex).toBeNull()
      })

      it("goToPreviousSession goes to second-to-last when viewing latest", () => {
        useAppStore.getState().goToPreviousSession()
        expect(useAppStore.getState().viewingSessionIndex).toBe(1) // Index 1 = session 2
      })

      it("goToPreviousSession decrements index", () => {
        useAppStore.getState().setViewingSessionIndex(2)
        useAppStore.getState().goToPreviousSession()
        expect(useAppStore.getState().viewingSessionIndex).toBe(1)

        useAppStore.getState().goToPreviousSession()
        expect(useAppStore.getState().viewingSessionIndex).toBe(0)
      })

      it("goToPreviousSession stays at 0 when at first session", () => {
        useAppStore.getState().setViewingSessionIndex(0)
        useAppStore.getState().goToPreviousSession()
        expect(useAppStore.getState().viewingSessionIndex).toBe(0)
      })

      it("goToNextSession increments index", () => {
        useAppStore.getState().setViewingSessionIndex(0)
        useAppStore.getState().goToNextSession()
        expect(useAppStore.getState().viewingSessionIndex).toBe(1)
      })

      it("goToNextSession switches to null when reaching last session", () => {
        useAppStore.getState().setViewingSessionIndex(2) // Last session index
        useAppStore.getState().goToNextSession()
        expect(useAppStore.getState().viewingSessionIndex).toBeNull()
      })

      it("goToNextSession does nothing when already viewing latest", () => {
        useAppStore.getState().goToNextSession()
        expect(useAppStore.getState().viewingSessionIndex).toBeNull()
      })

      it("goToLatestSession sets index to null", () => {
        useAppStore.getState().setViewingSessionIndex(1)
        useAppStore.getState().goToLatestSession()
        expect(useAppStore.getState().viewingSessionIndex).toBeNull()
      })
    })

    describe("session selectors", () => {
      beforeEach(() => {
        const events = createEventsWithSessions()
        events.forEach(e => useAppStore.getState().addEvent(e))
      })

      it("selectSessionCount returns correct count", () => {
        const state = useAppStore.getState()
        expect(selectSessionCount(state)).toBe(3)
      })

      it("selectViewingSessionIndex returns current index", () => {
        expect(selectViewingSessionIndex(useAppStore.getState())).toBeNull()

        useAppStore.getState().setViewingSessionIndex(1)
        expect(selectViewingSessionIndex(useAppStore.getState())).toBe(1)
      })

      it("selectIsViewingLatestSession returns correct value", () => {
        expect(selectIsViewingLatestSession(useAppStore.getState())).toBe(true)

        useAppStore.getState().setViewingSessionIndex(1)
        expect(selectIsViewingLatestSession(useAppStore.getState())).toBe(false)
      })

      it("selectCurrentSessionEvents returns correct events", () => {
        // Latest session
        let events = selectCurrentSessionEvents(useAppStore.getState())
        expect(events).toHaveLength(3)
        expect(events[0].timestamp).toBe(3000)

        // First session
        useAppStore.getState().setViewingSessionIndex(0)
        events = selectCurrentSessionEvents(useAppStore.getState())
        expect(events).toHaveLength(3)
        expect(events[0].timestamp).toBe(1000)
      })
    })
  })

  describe("connection status", () => {
    it("sets connection status", () => {
      useAppStore.getState().setConnectionStatus("connected")
      expect(useAppStore.getState().connectionStatus).toBe("connected")
    })

    it("updates through all connection states", () => {
      const { setConnectionStatus } = useAppStore.getState()

      setConnectionStatus("connecting")
      expect(useAppStore.getState().connectionStatus).toBe("connecting")

      setConnectionStatus("connected")
      expect(useAppStore.getState().connectionStatus).toBe("connected")

      setConnectionStatus("disconnected")
      expect(useAppStore.getState().connectionStatus).toBe("disconnected")
    })
  })

  describe("sidebar state", () => {
    it("sets sidebar width", () => {
      useAppStore.getState().setSidebarWidth(400)
      expect(useAppStore.getState().sidebarWidth).toBe(400)

      useAppStore.getState().setSidebarWidth(250)
      expect(useAppStore.getState().sidebarWidth).toBe(250)
    })

    it("persists sidebar width to localStorage", () => {
      useAppStore.getState().setSidebarWidth(450)
      const stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.sidebarWidth).toBe(450)
    })
  })

  describe("task chat panel state", () => {
    it("sets task chat open state", () => {
      useAppStore.getState().setTaskChatOpen(true)
      expect(useAppStore.getState().taskChatOpen).toBe(true)

      useAppStore.getState().setTaskChatOpen(false)
      expect(useAppStore.getState().taskChatOpen).toBe(false)
    })

    it("toggles task chat state", () => {
      // Initial state is true
      expect(useAppStore.getState().taskChatOpen).toBe(true)

      useAppStore.getState().toggleTaskChat()
      expect(useAppStore.getState().taskChatOpen).toBe(false)

      useAppStore.getState().toggleTaskChat()
      expect(useAppStore.getState().taskChatOpen).toBe(true)
    })

    it("sets task chat width", () => {
      useAppStore.getState().setTaskChatWidth(500)
      expect(useAppStore.getState().taskChatWidth).toBe(500)

      useAppStore.getState().setTaskChatWidth(350)
      expect(useAppStore.getState().taskChatWidth).toBe(350)
    })

    it("persists task chat width to localStorage", () => {
      useAppStore.getState().setTaskChatWidth(550)
      const stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.taskChatWidth).toBe(550)
    })

    it("persists task chat open state to localStorage", () => {
      useAppStore.getState().setTaskChatOpen(false)
      let stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.taskChatOpen).toBe(false)

      useAppStore.getState().setTaskChatOpen(true)
      stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.taskChatOpen).toBe(true)
    })

    it("persists task chat open state when toggling", () => {
      // Start with true
      useAppStore.getState().setTaskChatOpen(true)
      let stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.taskChatOpen).toBe(true)

      // Toggle to false
      useAppStore.getState().toggleTaskChat()
      expect(useAppStore.getState().taskChatOpen).toBe(false)
      stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.taskChatOpen).toBe(false)

      // Toggle back to true
      useAppStore.getState().toggleTaskChat()
      expect(useAppStore.getState().taskChatOpen).toBe(true)
      stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.taskChatOpen).toBe(true)
    })

    it("adds task chat messages", () => {
      const message: TaskChatMessage = {
        id: "msg-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      }
      useAppStore.getState().addTaskChatMessage(message)

      const messages = useAppStore.getState().taskChatMessages
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(message)
    })

    it("preserves message order", () => {
      const { addTaskChatMessage } = useAppStore.getState()

      addTaskChatMessage({ id: "1", role: "user", content: "First", timestamp: 1 })
      addTaskChatMessage({ id: "2", role: "assistant", content: "Second", timestamp: 2 })
      addTaskChatMessage({ id: "3", role: "user", content: "Third", timestamp: 3 })

      const messages = useAppStore.getState().taskChatMessages
      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe("First")
      expect(messages[1].content).toBe("Second")
      expect(messages[2].content).toBe("Third")
    })

    it("clears all task chat messages", () => {
      const { addTaskChatMessage, clearTaskChatMessages } = useAppStore.getState()

      addTaskChatMessage({ id: "1", role: "user", content: "Test", timestamp: 1 })
      addTaskChatMessage({ id: "2", role: "assistant", content: "Test", timestamp: 2 })
      expect(useAppStore.getState().taskChatMessages).toHaveLength(2)

      clearTaskChatMessages()
      expect(useAppStore.getState().taskChatMessages).toEqual([])
    })

    it("removes a specific task chat message by id", () => {
      const { addTaskChatMessage, removeTaskChatMessage } = useAppStore.getState()

      addTaskChatMessage({ id: "1", role: "user", content: "First", timestamp: 1 })
      addTaskChatMessage({ id: "2", role: "assistant", content: "Second", timestamp: 2 })
      addTaskChatMessage({ id: "3", role: "user", content: "Third", timestamp: 3 })
      expect(useAppStore.getState().taskChatMessages).toHaveLength(3)

      removeTaskChatMessage("2")
      const messages = useAppStore.getState().taskChatMessages
      expect(messages).toHaveLength(2)
      expect(messages[0].id).toBe("1")
      expect(messages[1].id).toBe("3")
    })

    it("does nothing when removing non-existent message id", () => {
      const { addTaskChatMessage, removeTaskChatMessage } = useAppStore.getState()

      addTaskChatMessage({ id: "1", role: "user", content: "Test", timestamp: 1 })
      expect(useAppStore.getState().taskChatMessages).toHaveLength(1)

      removeTaskChatMessage("non-existent")
      expect(useAppStore.getState().taskChatMessages).toHaveLength(1)
    })

    it("sets task chat loading state", () => {
      useAppStore.getState().setTaskChatLoading(true)
      expect(useAppStore.getState().taskChatLoading).toBe(true)

      useAppStore.getState().setTaskChatLoading(false)
      expect(useAppStore.getState().taskChatLoading).toBe(false)
    })

    it("adds a task chat event", () => {
      const event = {
        type: "stream_event",
        timestamp: Date.now(),
        event: { type: "content_block_delta", delta: { text: "Hello" } },
      }
      useAppStore.getState().addTaskChatEvent(event)
      flushTaskChatEventsBatch() // Flush batch to apply events immediately

      const events = useAppStore.getState().taskChatEvents
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(event)
    })

    it("preserves task chat event order", () => {
      const { addTaskChatEvent } = useAppStore.getState()

      addTaskChatEvent({ type: "stream_event", timestamp: 1, event: { type: "message_start" } })
      addTaskChatEvent({
        type: "stream_event",
        timestamp: 2,
        event: { type: "content_block_delta" },
      })
      addTaskChatEvent({ type: "assistant", timestamp: 3, message: { content: [] } })
      flushTaskChatEventsBatch() // Flush batch to apply events immediately

      const events = useAppStore.getState().taskChatEvents
      expect(events).toHaveLength(3)
      expect(events[0].timestamp).toBe(1)
      expect(events[1].timestamp).toBe(2)
      expect(events[2].timestamp).toBe(3)
    })

    it("clears task chat events", () => {
      const { addTaskChatEvent, clearTaskChatEvents } = useAppStore.getState()

      addTaskChatEvent({ type: "stream_event", timestamp: 1, event: {} })
      addTaskChatEvent({ type: "assistant", timestamp: 2, message: {} })
      flushTaskChatEventsBatch() // Flush batch to apply events immediately
      expect(useAppStore.getState().taskChatEvents).toHaveLength(2)

      clearTaskChatEvents()
      expect(useAppStore.getState().taskChatEvents).toEqual([])
    })

    it("clearTaskChatMessages also clears task chat events", () => {
      const { addTaskChatMessage, addTaskChatEvent, clearTaskChatMessages } = useAppStore.getState()

      addTaskChatMessage({ id: "1", role: "user", content: "Test", timestamp: 1 })
      addTaskChatEvent({ type: "stream_event", timestamp: 2, event: {} })
      flushTaskChatEventsBatch() // Flush batch to apply events immediately
      expect(useAppStore.getState().taskChatMessages).toHaveLength(1)
      expect(useAppStore.getState().taskChatEvents).toHaveLength(1)

      clearTaskChatMessages()
      expect(useAppStore.getState().taskChatMessages).toEqual([])
      expect(useAppStore.getState().taskChatEvents).toEqual([])
    })

    it("batches multiple addTaskChatEvent calls into a single state update", async () => {
      const { addTaskChatEvent } = useAppStore.getState()

      // Add multiple events without flushing
      addTaskChatEvent({ type: "stream_event", timestamp: 1, event: { type: "start" } })
      addTaskChatEvent({ type: "stream_event", timestamp: 2, event: { type: "delta" } })
      addTaskChatEvent({ type: "stream_event", timestamp: 3, event: { type: "end" } })

      // Events should NOT be in state yet (still batched)
      expect(useAppStore.getState().taskChatEvents).toHaveLength(0)

      // Flush the batch
      flushTaskChatEventsBatch()

      // Now all events should be in state
      expect(useAppStore.getState().taskChatEvents).toHaveLength(3)
      expect(useAppStore.getState().taskChatEvents[0].timestamp).toBe(1)
      expect(useAppStore.getState().taskChatEvents[1].timestamp).toBe(2)
      expect(useAppStore.getState().taskChatEvents[2].timestamp).toBe(3)
    })

    it("auto-flushes batch after timeout", async () => {
      vi.useFakeTimers()
      const { addTaskChatEvent } = useAppStore.getState()

      // Add an event
      addTaskChatEvent({ type: "stream_event", timestamp: 1, event: { type: "test" } })

      // Events should NOT be in state yet
      expect(useAppStore.getState().taskChatEvents).toHaveLength(0)

      // Advance timers past the batch interval (100ms)
      await vi.advanceTimersByTimeAsync(150)

      // Now the event should be in state
      expect(useAppStore.getState().taskChatEvents).toHaveLength(1)

      vi.useRealTimers()
    })

    it("clearTaskChatEvents cancels pending batch", () => {
      const { addTaskChatEvent, clearTaskChatEvents } = useAppStore.getState()

      // Add events to batch
      addTaskChatEvent({ type: "stream_event", timestamp: 1, event: {} })
      addTaskChatEvent({ type: "stream_event", timestamp: 2, event: {} })

      // Clear should cancel the batch
      clearTaskChatEvents()

      // Flush should have no effect since batch was cleared
      flushTaskChatEventsBatch()

      // State should still be empty
      expect(useAppStore.getState().taskChatEvents).toEqual([])
    })
  })

  describe("sidebar width localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it("loads sidebar width from localStorage on store creation", async () => {
      // Set localStorage using persist middleware format
      localStorage.setItem(PERSIST_NAME, createPersistedState({ sidebarWidth: 400 }))

      // Re-import the module to get fresh store instance
      // We need to use dynamic import to force re-evaluation
      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().sidebarWidth).toBe(400)
    })

    it("uses default width when localStorage is empty", async () => {
      localStorage.clear()

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().sidebarWidth).toBe(320)
    })

    it("uses default width when localStorage value is invalid", async () => {
      // Persist middleware handles invalid JSON gracefully by using defaults
      localStorage.setItem(PERSIST_NAME, "invalid-json")

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().sidebarWidth).toBe(320)
    })
  })

  describe("task chat width localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it("loads task chat width from localStorage on store creation", async () => {
      localStorage.setItem(PERSIST_NAME, createPersistedState({ taskChatWidth: 500 }))

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatWidth).toBe(500)
    })

    it("uses default width when localStorage is empty", async () => {
      localStorage.clear()

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatWidth).toBe(400)
    })

    it("uses default width when localStorage value is invalid", async () => {
      // Persist middleware handles invalid JSON gracefully by using defaults
      localStorage.setItem(PERSIST_NAME, "invalid-json")

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatWidth).toBe(400)
    })
  })

  describe("task chat open state localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it("loads task chat open state from localStorage on store creation", async () => {
      localStorage.setItem(PERSIST_NAME, createPersistedState({ taskChatOpen: false }))

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatOpen).toBe(false)
    })

    it("loads true state from localStorage on store creation", async () => {
      localStorage.setItem(PERSIST_NAME, createPersistedState({ taskChatOpen: true }))

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatOpen).toBe(true)
    })

    it("uses default open state (true) when localStorage is empty", async () => {
      localStorage.clear()

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatOpen).toBe(true)
    })

    it("uses default open state when localStorage value is invalid", async () => {
      // Persist middleware handles invalid JSON gracefully by using defaults
      localStorage.setItem(PERSIST_NAME, "invalid-json")

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      expect(freshStore.getState().taskChatOpen).toBe(true)
    })
  })

  describe("activeInstanceId localStorage persistence", () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it("persists activeInstanceId to localStorage when switching instances", () => {
      // Create a second instance
      const state = useAppStore.getState()
      const newInstance = createRalphInstance("second-instance", "Second")
      const newInstances = new Map(state.instances)
      newInstances.set("second-instance", newInstance)
      useAppStore.setState({ instances: newInstances })

      // Switch to the new instance
      useAppStore.getState().setActiveInstanceId("second-instance")

      const stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.activeInstanceId).toBe("second-instance")
    })

    it("persists activeInstanceId to localStorage when creating a new instance", () => {
      useAppStore.getState().createInstance("new-instance", "New Instance")

      const stored = JSON.parse(localStorage.getItem(PERSIST_NAME) ?? "{}")
      expect(stored.state?.activeInstanceId).toBe("new-instance")
    })

    it("does not change activeInstanceId when switching to non-existent instance", () => {
      const originalActiveId = useAppStore.getState().activeInstanceId

      // Try to switch to non-existent instance
      useAppStore.getState().setActiveInstanceId("non-existent")

      // Should still be the original value in state
      expect(useAppStore.getState().activeInstanceId).toBe(originalActiveId)
    })

    it("does not persist when switching to the same instance", () => {
      const originalActiveId = useAppStore.getState().activeInstanceId

      // Switch to the same instance
      useAppStore.getState().setActiveInstanceId(originalActiveId)

      // State should remain unchanged (the persist middleware only writes on actual state changes)
      expect(useAppStore.getState().activeInstanceId).toBe(originalActiveId)
    })

    it("loads activeInstanceId from localStorage on store creation", async () => {
      // First create an instance with this ID to make it valid
      useAppStore.getState().createInstance("persisted-instance", "Persisted")

      vi.resetModules()
      const { useAppStore: freshStore } = await import("./index")

      // With persist middleware, both instances and activeInstanceId are persisted together.
      // Since we created "persisted-instance" above, it gets persisted and rehydrated,
      // so the activeInstanceId remains valid.
      expect(freshStore.getState().activeInstanceId).toBe("persisted-instance")
      expect(freshStore.getState().instances.has("persisted-instance")).toBe(true)
    })

    it("uses default ID when localStorage has non-existent instance ID", async () => {
      // Set localStorage with a non-existent instance ID (but valid format)
      // The persist middleware's merge function will validate that activeInstanceId
      // exists in instances and fall back to currentState's activeInstanceId if not
      const persistedInstance = createRalphInstance("other-instance", "Other")
      const instances = new Map([[persistedInstance.id, persistedInstance]])
      localStorage.setItem(
        PERSIST_NAME,
        JSON.stringify({
          state: {
            ...JSON.parse(createPersistedState({})).state,
            activeInstanceId: "non-existent-instance", // This ID is not in instances
            instances: serializeInstances(instances, "other-instance"),
          },
          version: 1,
        }),
      )

      vi.resetModules()
      const { useAppStore: freshStore, DEFAULT_INSTANCE_ID: freshDefaultId } =
        await import("./index")

      // Should fall back to the default instance since the stored activeInstanceId
      // doesn't exist in the persisted instances, and the merge function uses
      // currentState.activeInstanceId as fallback
      expect(freshStore.getState().activeInstanceId).toBe(freshDefaultId)
    })

    it("uses default ID when localStorage is empty", async () => {
      localStorage.clear()

      vi.resetModules()
      const { useAppStore: freshStore, DEFAULT_INSTANCE_ID: freshDefaultId } =
        await import("./index")

      expect(freshStore.getState().activeInstanceId).toBe(freshDefaultId)
    })

    it("uses default ID when localStorage has invalid JSON", async () => {
      localStorage.setItem(PERSIST_NAME, "invalid-json")

      vi.resetModules()
      const { useAppStore: freshStore, DEFAULT_INSTANCE_ID: freshDefaultId } =
        await import("./index")

      expect(freshStore.getState().activeInstanceId).toBe(freshDefaultId)
    })
  })

  describe("reset", () => {
    it("resets all state to initial values", () => {
      // Modify all state
      const {
        setRalphStatus,
        addEvent,
        setTasks,
        setWorkspace,
        setAccentColor,
        setBranch,
        setTokenUsage,
        setSession,
        setConnectionStatus,
        setSidebarWidth,
        setTaskChatOpen,
        setTaskChatWidth,
        addTaskChatMessage,
        setTaskChatLoading,
      } = useAppStore.getState()

      setRalphStatus("running")
      addEvent({ type: "test", timestamp: 1 })
      setTasks([{ id: "1", title: "Task", status: "open" }])
      setWorkspace("/path")
      setAccentColor("#4d9697")
      setBranch("feature/test")
      setTokenUsage({ input: 1000, output: 500 })
      setSession({ current: 5, total: 10 })
      setConnectionStatus("connected")
      setSidebarWidth(400)
      setTaskChatOpen(true)
      setTaskChatWidth(500)
      addTaskChatMessage({ id: "1", role: "user", content: "Test", timestamp: 1 })
      useAppStore.getState().addTaskChatEvent({ type: "stream_event", timestamp: 1, event: {} })
      flushTaskChatEventsBatch() // Flush batch to apply events immediately
      setTaskChatLoading(true)

      // Verify state is modified
      let state = useAppStore.getState()
      expect(state.ralphStatus).toBe("running")
      expect(state.events).toHaveLength(1)
      expect(state.tasks).toHaveLength(1)
      expect(state.workspace).toBe("/path")
      expect(state.accentColor).toBe("#4d9697")
      expect(state.branch).toBe("feature/test")
      expect(state.tokenUsage).toEqual({ input: 1000, output: 500 })
      expect(state.session).toEqual({ current: 5, total: 10 })
      expect(state.connectionStatus).toBe("connected")
      expect(state.sidebarWidth).toBe(400)
      expect(state.taskChatOpen).toBe(true)
      expect(state.taskChatWidth).toBe(500)
      expect(state.taskChatMessages).toHaveLength(1)
      expect(state.taskChatEvents).toHaveLength(1)
      expect(state.taskChatLoading).toBe(true)

      // Reset
      useAppStore.getState().reset()

      // Verify reset
      state = useAppStore.getState()
      expect(state.ralphStatus).toBe("stopped")
      expect(state.events).toEqual([])
      expect(state.tasks).toEqual([])
      expect(state.workspace).toBeNull()
      expect(state.accentColor).toBeNull()
      expect(state.branch).toBeNull()
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 })
      expect(state.session).toEqual({ current: 0, total: 0 })
      expect(state.connectionStatus).toBe("disconnected")
      expect(state.sidebarWidth).toBe(320)
      expect(state.taskChatOpen).toBe(true)
      expect(state.taskChatWidth).toBe(400)
      expect(state.taskChatMessages).toEqual([])
      expect(state.taskChatEvents).toEqual([])
      expect(state.taskChatLoading).toBe(false)
      expect(state.viewingSessionIndex).toBeNull()
    })
  })

  describe("search visibility", () => {
    it("has isSearchVisible false initially", () => {
      expect(useAppStore.getState().isSearchVisible).toBe(false)
    })

    it("setSearchVisible sets the visibility", () => {
      useAppStore.getState().setSearchVisible(true)
      expect(useAppStore.getState().isSearchVisible).toBe(true)

      useAppStore.getState().setSearchVisible(false)
      expect(useAppStore.getState().isSearchVisible).toBe(false)
    })

    it("showSearch sets isSearchVisible to true", () => {
      useAppStore.getState().showSearch()
      expect(useAppStore.getState().isSearchVisible).toBe(true)
    })

    it("hideSearch sets isSearchVisible to false", () => {
      useAppStore.getState().showSearch()
      expect(useAppStore.getState().isSearchVisible).toBe(true)

      useAppStore.getState().hideSearch()
      expect(useAppStore.getState().isSearchVisible).toBe(false)
    })

    it("hideSearch also clears the search query", () => {
      useAppStore.getState().setTaskSearchQuery("test query")
      useAppStore.getState().showSearch()

      expect(useAppStore.getState().taskSearchQuery).toBe("test query")
      expect(useAppStore.getState().isSearchVisible).toBe(true)

      useAppStore.getState().hideSearch()
      expect(useAppStore.getState().taskSearchQuery).toBe("")
      expect(useAppStore.getState().isSearchVisible).toBe(false)
    })
  })

  describe("per-instance actions", () => {
    beforeEach(() => {
      // Create two instances for testing
      useAppStore.getState().createInstance("instance-1", "Instance 1", "Ralph-1")
      useAppStore.getState().createInstance("instance-2", "Instance 2", "Ralph-2")
      // Set instance-1 as active
      useAppStore.getState().setActiveInstanceId("instance-1")
    })

    describe("addEventForInstance action", () => {
      it("adds event to a specific instance", () => {
        const event: ChatEvent = { type: "tool_use", timestamp: 1234 }

        useAppStore.getState().addEventForInstance("instance-2", event)

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.events).toContainEqual(event)
      })

      it("does not affect other instances", () => {
        const event: ChatEvent = { type: "tool_use", timestamp: 1234 }

        useAppStore.getState().addEventForInstance("instance-2", event)

        const instance1 = useAppStore.getState().instances.get("instance-1")
        expect(instance1?.events).not.toContainEqual(event)
      })

      it("updates flat fields when adding to active instance", () => {
        const event: ChatEvent = { type: "tool_use", timestamp: 1234 }

        useAppStore.getState().addEventForInstance("instance-1", event)

        expect(useAppStore.getState().events).toContainEqual(event)
      })

      it("does not update flat fields when adding to non-active instance", () => {
        const event: ChatEvent = { type: "tool_use", timestamp: 1234 }

        useAppStore.getState().addEventForInstance("instance-2", event)

        expect(useAppStore.getState().events).not.toContainEqual(event)
      })

      it("warns when adding to non-existent instance", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        const event: ChatEvent = { type: "tool_use", timestamp: 1234 }

        useAppStore.getState().addEventForInstance("non-existent", event)

        expect(warnSpy).toHaveBeenCalledWith(
          "[store] Cannot add event to non-existent instance: non-existent",
        )
        warnSpy.mockRestore()
      })
    })

    describe("setEventsForInstance action", () => {
      it("sets events for a specific instance", () => {
        const events: ChatEvent[] = [
          { type: "tool_use", timestamp: 1234 },
          { type: "tool_result", timestamp: 1235 },
        ]

        useAppStore.getState().setEventsForInstance("instance-2", events)

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.events).toEqual(events)
      })

      it("replaces existing events", () => {
        // Add initial event
        useAppStore.getState().addEventForInstance("instance-2", { type: "old", timestamp: 1000 })

        // Replace with new events
        const newEvents: ChatEvent[] = [{ type: "new", timestamp: 2000 }]
        useAppStore.getState().setEventsForInstance("instance-2", newEvents)

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.events).toEqual(newEvents)
      })

      it("updates flat fields when setting for active instance", () => {
        const events: ChatEvent[] = [{ type: "tool_use", timestamp: 1234 }]

        useAppStore.getState().setEventsForInstance("instance-1", events)

        expect(useAppStore.getState().events).toEqual(events)
      })
    })

    describe("setStatusForInstance action", () => {
      it("sets status for a specific instance", () => {
        useAppStore.getState().setStatusForInstance("instance-2", "running")

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.status).toBe("running")
      })

      it("sets runStartedAt when transitioning to running", () => {
        useAppStore.getState().setStatusForInstance("instance-2", "running")

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.runStartedAt).not.toBeNull()
      })

      it("clears runStartedAt when transitioning to stopped", () => {
        // First set to running
        useAppStore.getState().setStatusForInstance("instance-2", "running")
        expect(useAppStore.getState().instances.get("instance-2")?.runStartedAt).not.toBeNull()

        // Then stop
        useAppStore.getState().setStatusForInstance("instance-2", "stopped")
        expect(useAppStore.getState().instances.get("instance-2")?.runStartedAt).toBeNull()
      })

      it("updates flat fields when setting for active instance", () => {
        useAppStore.getState().setStatusForInstance("instance-1", "running")

        expect(useAppStore.getState().ralphStatus).toBe("running")
        expect(useAppStore.getState().runStartedAt).not.toBeNull()
      })

      it("does not update flat fields when setting for non-active instance", () => {
        useAppStore.getState().setStatusForInstance("instance-2", "running")

        expect(useAppStore.getState().ralphStatus).toBe("stopped")
      })
    })

    describe("addTokenUsageForInstance action", () => {
      it("adds token usage to a specific instance", () => {
        useAppStore.getState().addTokenUsageForInstance("instance-2", { input: 100, output: 50 })

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.tokenUsage).toEqual({ input: 100, output: 50 })
      })

      it("accumulates token usage", () => {
        useAppStore.getState().addTokenUsageForInstance("instance-2", { input: 100, output: 50 })
        useAppStore.getState().addTokenUsageForInstance("instance-2", { input: 200, output: 100 })

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.tokenUsage).toEqual({ input: 300, output: 150 })
      })

      it("updates flat fields when adding to active instance", () => {
        useAppStore.getState().addTokenUsageForInstance("instance-1", { input: 100, output: 50 })

        expect(useAppStore.getState().tokenUsage).toEqual({ input: 100, output: 50 })
      })
    })

    describe("updateContextWindowUsedForInstance action", () => {
      it("updates context window for a specific instance", () => {
        useAppStore.getState().updateContextWindowUsedForInstance("instance-2", 50000)

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.contextWindow.used).toBe(50000)
      })

      it("updates flat fields when updating active instance", () => {
        useAppStore.getState().updateContextWindowUsedForInstance("instance-1", 75000)

        expect(useAppStore.getState().contextWindow.used).toBe(75000)
      })
    })

    describe("setSessionForInstance action", () => {
      it("sets session for a specific instance", () => {
        useAppStore.getState().setSessionForInstance("instance-2", { current: 3, total: 5 })

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.session).toEqual({ current: 3, total: 5 })
      })

      it("updates flat fields when setting for active instance", () => {
        useAppStore.getState().setSessionForInstance("instance-1", { current: 2, total: 4 })

        expect(useAppStore.getState().session).toEqual({ current: 2, total: 4 })
      })
    })

    describe("resetSessionStatsForInstance action", () => {
      it("resets session stats for a specific instance", () => {
        // Set up state on instance-2
        useAppStore.getState().addTokenUsageForInstance("instance-2", { input: 2000, output: 1000 })
        useAppStore.getState().updateContextWindowUsedForInstance("instance-2", 80000)
        useAppStore.getState().setSessionForInstance("instance-2", { current: 5, total: 10 })

        // Verify state was set
        let instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.tokenUsage).toEqual({ input: 2000, output: 1000 })
        expect(instance2?.contextWindow.used).toBe(80000)
        expect(instance2?.session).toEqual({ current: 5, total: 10 })

        // Reset session stats for instance-2
        useAppStore.getState().resetSessionStatsForInstance("instance-2")

        // Verify all session stats were reset
        instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.tokenUsage).toEqual({ input: 0, output: 0 })
        expect(instance2?.contextWindow).toEqual({ used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX })
        expect(instance2?.session).toEqual({ current: 0, total: 0 })
      })

      it("updates flat fields when resetting for active instance", () => {
        // Set up state on the active instance (instance-1)
        useAppStore.getState().addTokenUsageForInstance("instance-1", { input: 4000, output: 2000 })
        useAppStore.getState().updateContextWindowUsedForInstance("instance-1", 120000)
        useAppStore.getState().setSessionForInstance("instance-1", { current: 8, total: 12 })

        // Verify flat fields were set
        expect(useAppStore.getState().tokenUsage).toEqual({ input: 4000, output: 2000 })
        expect(useAppStore.getState().contextWindow.used).toBe(120000)
        expect(useAppStore.getState().session).toEqual({ current: 8, total: 12 })

        // Reset session stats for the active instance
        useAppStore.getState().resetSessionStatsForInstance("instance-1")

        // Verify flat fields were also reset
        expect(useAppStore.getState().tokenUsage).toEqual({ input: 0, output: 0 })
        expect(useAppStore.getState().contextWindow).toEqual({
          used: 0,
          max: DEFAULT_CONTEXT_WINDOW_MAX,
        })
        expect(useAppStore.getState().session).toEqual({ current: 0, total: 0 })
      })

      it("does not update flat fields when resetting non-active instance", () => {
        // Set up state on both instances
        useAppStore.getState().addTokenUsageForInstance("instance-1", { input: 1000, output: 500 })
        useAppStore.getState().addTokenUsageForInstance("instance-2", { input: 3000, output: 1500 })

        // Verify flat fields match active instance (instance-1)
        expect(useAppStore.getState().tokenUsage).toEqual({ input: 1000, output: 500 })

        // Reset session stats for non-active instance (instance-2)
        useAppStore.getState().resetSessionStatsForInstance("instance-2")

        // Verify flat fields were NOT affected (still match instance-1)
        expect(useAppStore.getState().tokenUsage).toEqual({ input: 1000, output: 500 })

        // But instance-2 should be reset
        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.tokenUsage).toEqual({ input: 0, output: 0 })
      })

      it("does nothing for non-existent instance", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

        useAppStore.getState().resetSessionStatsForInstance("non-existent")

        expect(warnSpy).toHaveBeenCalledWith(
          "[store] Cannot reset session stats for non-existent instance: non-existent",
        )
        warnSpy.mockRestore()
      })

      it("preserves other instance state when resetting one instance", () => {
        // Set up state on both instances
        useAppStore.getState().addTokenUsageForInstance("instance-1", { input: 1500, output: 750 })
        useAppStore.getState().addTokenUsageForInstance("instance-2", { input: 2500, output: 1250 })
        useAppStore.getState().setSessionForInstance("instance-1", { current: 3, total: 6 })
        useAppStore.getState().setSessionForInstance("instance-2", { current: 4, total: 8 })

        // Reset only instance-2
        useAppStore.getState().resetSessionStatsForInstance("instance-2")

        // Verify instance-1 was NOT affected
        const instance1 = useAppStore.getState().instances.get("instance-1")
        expect(instance1?.tokenUsage).toEqual({ input: 1500, output: 750 })
        expect(instance1?.session).toEqual({ current: 3, total: 6 })
      })
    })

    describe("setMergeConflictForInstance action", () => {
      it("sets merge conflict for a specific instance", () => {
        const conflict = {
          files: ["file1.ts", "file2.ts"],
          sourceBranch: "ralph/instance-2",
          timestamp: Date.now(),
        }
        useAppStore.getState().setMergeConflictForInstance("instance-2", conflict)

        const instance2 = useAppStore.getState().instances.get("instance-2")
        expect(instance2?.mergeConflict).toEqual(conflict)
      })

      it("clears merge conflict when set to null", () => {
        const conflict = {
          files: ["file1.ts"],
          sourceBranch: "ralph/instance-1",
          timestamp: Date.now(),
        }
        useAppStore.getState().setMergeConflictForInstance("instance-1", conflict)

        const instance = useAppStore.getState().instances.get("instance-1")
        expect(instance?.mergeConflict).toEqual(conflict)

        useAppStore.getState().setMergeConflictForInstance("instance-1", null)

        const updatedInstance = useAppStore.getState().instances.get("instance-1")
        expect(updatedInstance?.mergeConflict).toBeNull()
      })

      it("does nothing for non-existent instance", () => {
        const stateBefore = useAppStore.getState()
        useAppStore.getState().setMergeConflictForInstance("non-existent", {
          files: ["file1.ts"],
          sourceBranch: "ralph/non-existent",
          timestamp: Date.now(),
        })
        const stateAfter = useAppStore.getState()

        // State should be unchanged (except possibly internal timestamps)
        expect(stateAfter.instances.size).toBe(stateBefore.instances.size)
      })
    })

    describe("clearMergeConflictForInstance action", () => {
      it("clears merge conflict for a specific instance", () => {
        const conflict = {
          files: ["file1.ts"],
          sourceBranch: "ralph/instance-1",
          timestamp: Date.now(),
        }
        useAppStore.getState().setMergeConflictForInstance("instance-1", conflict)
        useAppStore.getState().clearMergeConflictForInstance("instance-1")

        const instance = useAppStore.getState().instances.get("instance-1")
        expect(instance?.mergeConflict).toBeNull()
      })

      it("does nothing for non-existent instance", () => {
        const stateBefore = useAppStore.getState()
        useAppStore.getState().clearMergeConflictForInstance("non-existent")
        const stateAfter = useAppStore.getState()

        expect(stateAfter.instances.size).toBe(stateBefore.instances.size)
      })
    })
  })

  describe("reconnection state (auto-resume)", () => {
    describe("markRunningBeforeDisconnect action", () => {
      it("sets wasRunningBeforeDisconnect to true when ralph is running", () => {
        useAppStore.getState().setRalphStatus("running")
        useAppStore.getState().markRunningBeforeDisconnect()
        expect(useAppStore.getState().wasRunningBeforeDisconnect).toBe(true)
      })

      it("sets wasRunningBeforeDisconnect to true when ralph is paused", () => {
        useAppStore.getState().setRalphStatus("paused")
        useAppStore.getState().markRunningBeforeDisconnect()
        expect(useAppStore.getState().wasRunningBeforeDisconnect).toBe(true)
      })

      it("sets wasRunningBeforeDisconnect to false when ralph is stopped", () => {
        useAppStore.getState().setRalphStatus("stopped")
        useAppStore.getState().markRunningBeforeDisconnect()
        expect(useAppStore.getState().wasRunningBeforeDisconnect).toBe(false)
      })

      it("sets wasRunningBeforeDisconnect to false when ralph is starting", () => {
        useAppStore.getState().setRalphStatus("starting")
        useAppStore.getState().markRunningBeforeDisconnect()
        expect(useAppStore.getState().wasRunningBeforeDisconnect).toBe(false)
      })
    })

    describe("clearRunningBeforeDisconnect action", () => {
      it("clears wasRunningBeforeDisconnect", () => {
        useAppStore.getState().setRalphStatus("running")
        useAppStore.getState().markRunningBeforeDisconnect()
        useAppStore.getState().clearRunningBeforeDisconnect()
        expect(useAppStore.getState().wasRunningBeforeDisconnect).toBe(false)
      })
    })
  })
})
