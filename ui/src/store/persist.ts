/**
 * Zustand persist middleware configuration for UI state persistence.
 *
 * This module provides configuration for persisting a subset of the app state
 * to localStorage, enabling state restoration across page reloads.
 *
 * Key design decisions:
 * - Only UI preferences, view state, and workspace metadata are persisted
 * - Events are NOT persisted to localStorage (they are persisted to IndexedDB in ralphConnection.ts)
 * - Map/Set are serialized to arrays for JSON compatibility
 * - Schema versioning supports migrations for future changes
 */

import { createJSONStorage, type PersistOptions } from "zustand/middleware"
import type { AppState, AppActions } from "./index"
import type { RalphInstance, Theme, ClosedTasksTimeFilter, TaskGroup } from "@/types"
import { DEFAULT_CONTEXT_WINDOW_MAX } from "./index"
import {
  TASK_LIST_STATUS_STORAGE_KEY,
  TASK_LIST_PARENT_STORAGE_KEY,
  TASK_INPUT_DRAFT_STORAGE_KEY,
  TASK_CHAT_INPUT_DRAFT_STORAGE_KEY,
  THEME_STORAGE_KEY,
  VSCODE_THEME_STORAGE_KEY,
  LAST_DARK_THEME_STORAGE_KEY,
  LAST_LIGHT_THEME_STORAGE_KEY,
} from "@/constants"

/** Current schema version for persistence format */
export const PERSIST_VERSION = 6

/** Storage key for persisted state */
export const PERSIST_NAME = "ralph-ui-store"

/**
 * Serialized form of RalphInstance for JSON storage.
 * Events are NOT included - they are persisted to IndexedDB separately.
 */
export interface SerializedRalphInstance {
  id: string
  name: string
  agentName: string
  status: string
  tokenUsage: { input: number; output: number }
  contextWindow: { used: number; max: number }
  session: { current: number; total: number }
  worktreePath: string | null
  branch: string | null
  currentTaskId: string | null
  createdAt: number
  runStartedAt: number | null
  mergeConflict: {
    files: string[]
    sourceBranch: string
    timestamp: number
  } | null
}

/**
 * State shape after partialize - only the fields we persist.
 * This is what gets serialized to localStorage.
 */
export interface PersistedState {
  // UI preferences - widths are stored as percentages of window width (0-100)
  sidebarWidth: number
  taskChatOpen: boolean
  taskChatWidth: number
  showToolOutput: boolean
  theme: Theme
  closedTimeFilter: ClosedTasksTimeFilter

  // VS Code theme persistence
  vscodeThemeId: string | null
  lastDarkThemeId: string | null
  lastLightThemeId: string | null

  // Task chat session (for restoration on refresh)
  currentTaskChatSessionId: string | null

  // View state
  viewingSessionIndex: number | null
  taskSearchQuery: string
  selectedTaskId: string | null
  isSearchVisible: boolean

  // Task list collapsed states
  statusCollapsedState: Record<TaskGroup, boolean>
  parentCollapsedState: Record<string, boolean>

  // Input draft states
  taskInputDraft: string
  taskChatInputDraft: string

  // Comment drafts per task (taskId -> draft text)
  commentDrafts: Record<string, string>

  // Workspace metadata
  workspace: string | null
  branch: string | null
  issuePrefix: string | null
  accentColor: string | null

  // Tasks (lightweight, will be resynced from server)
  tasks: AppState["tasks"]

  // Instances (serialized from Map to array)
  instances: SerializedRalphInstance[]
  activeInstanceId: string
}

/**
 * Serializes the instances Map to an array for JSON storage.
 * Events are NOT included - they are persisted to IndexedDB separately.
 *
 * @param instances - The Map of RalphInstances from state
 * @param _activeInstanceId - The ID of the currently active instance (unused, kept for API compatibility)
 * @returns Array of serialized instances suitable for JSON
 */
export function serializeInstances(
  instances: Map<string, RalphInstance>,
  _activeInstanceId: string,
): SerializedRalphInstance[] {
  const result: SerializedRalphInstance[] = []

  for (const [, instance] of instances) {
    result.push({
      id: instance.id,
      name: instance.name,
      agentName: instance.agentName,
      status: instance.status,
      // Events are NOT stored in localStorage - they are persisted to IndexedDB
      tokenUsage: instance.tokenUsage,
      contextWindow: instance.contextWindow,
      session: instance.session,
      worktreePath: instance.worktreePath,
      branch: instance.branch,
      currentTaskId: instance.currentTaskId,
      createdAt: instance.createdAt,
      runStartedAt: instance.runStartedAt,
      mergeConflict: instance.mergeConflict,
    })
  }

  return result
}

/**
 * Deserializes an array of instances back to a Map.
 * Restores RalphInstance structure with proper defaults.
 * Events are initialized as empty - they will be restored from IndexedDB by useStoreHydration.
 *
 * @param serialized - Array of serialized instances from storage
 * @returns Map of RalphInstances
 */
export function deserializeInstances(
  serialized: SerializedRalphInstance[],
): Map<string, RalphInstance> {
  const map = new Map<string, RalphInstance>()

  for (const item of serialized) {
    const instance: RalphInstance = {
      id: item.id,
      name: item.name,
      agentName: item.agentName,
      status: item.status as RalphInstance["status"],
      // Events are NOT stored in localStorage - they will be restored from IndexedDB
      events: [],
      tokenUsage: item.tokenUsage ?? { input: 0, output: 0 },
      contextWindow: item.contextWindow ?? { used: 0, max: DEFAULT_CONTEXT_WINDOW_MAX },
      session: item.session ?? { current: 0, total: 0 },
      worktreePath: item.worktreePath,
      branch: item.branch,
      currentTaskId: item.currentTaskId,
      createdAt: item.createdAt ?? Date.now(),
      runStartedAt: item.runStartedAt,
      mergeConflict: item.mergeConflict,
    }
    map.set(item.id, instance)
  }

  return map
}

/**
 * Partialize function that selects which state fields to persist.
 * Returns only the subset of state that should be saved to localStorage.
 *
 * Whitelisted categories:
 * - UI preferences (sidebar, task chat, tool output, theme, filters)
 * - View state (session index, search, selection)
 * - Workspace metadata (path, branch, prefix, color)
 * - Tasks (will be resynced but provides faster initial render)
 * - Instances (serialized with events only for active instance)
 *
 * Excluded:
 * - Connection status (runtime only)
 * - Ralph status (managed by server)
 * - Event log viewer state (transient)
 * - Task chat messages/events (ephemeral)
 * - Hotkeys dialog state (transient UI)
 * - Visible task IDs (computed from tasks)
 * - Run timestamps (runtime)
 * - Initial task count (runtime)
 * - Reconnection state (runtime)
 */
export function partialize(state: AppState): PersistedState {
  return {
    // UI preferences
    sidebarWidth: state.sidebarWidth,
    taskChatOpen: state.taskChatOpen,
    taskChatWidth: state.taskChatWidth,
    showToolOutput: state.showToolOutput,
    theme: state.theme,
    closedTimeFilter: state.closedTimeFilter,

    // VS Code theme persistence
    vscodeThemeId: state.vscodeThemeId,
    lastDarkThemeId: state.lastDarkThemeId,
    lastLightThemeId: state.lastLightThemeId,

    // Task chat session (for restoration on refresh)
    currentTaskChatSessionId: state.currentTaskChatSessionId,

    // View state
    viewingSessionIndex: state.viewingSessionIndex,
    taskSearchQuery: state.taskSearchQuery,
    selectedTaskId: state.selectedTaskId,
    isSearchVisible: state.isSearchVisible,

    // Task list collapsed states
    statusCollapsedState: state.statusCollapsedState,
    parentCollapsedState: state.parentCollapsedState,

    // Input draft states
    taskInputDraft: state.taskInputDraft,
    taskChatInputDraft: state.taskChatInputDraft,

    // Comment drafts per task
    commentDrafts: state.commentDrafts,

    // Workspace metadata
    workspace: state.workspace,
    branch: state.branch,
    issuePrefix: state.issuePrefix,
    accentColor: state.accentColor,

    // Tasks
    tasks: state.tasks,

    // Instances (serialized)
    instances: serializeInstances(state.instances, state.activeInstanceId),
    activeInstanceId: state.activeInstanceId,
  }
}

/**
 * Custom storage adapter using localStorage with error handling.
 * Provides type-safe access with error handling.
 */
export const rawStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name)
    } catch {
      // localStorage may not be available (SSR, private mode, etc.)
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value)
    } catch {
      // localStorage may not be available or quota exceeded
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name)
    } catch {
      // localStorage may not be available
    }
  },
}

/**
 * JSON storage adapter for Zustand persist middleware.
 * Wraps rawStorage with JSON serialization.
 */
export const storage = createJSONStorage<PersistedState>(() => rawStorage)

/**
 * Callback invoked when rehydration starts.
 * Returns a callback that's invoked when rehydration completes.
 *
 * Usage:
 * - Pre-rehydration: Set loading state, prepare UI
 * - Post-rehydration: Clear loading state, validate/sync with server
 */
export function onRehydrateStorage(_state: AppState | undefined) {
  // Pre-rehydration callback (currently a no-op, kept for future use)

  // Post-rehydration callback
  return (
    rehydratedState: (AppState & { _hasHydrated?: boolean }) | undefined,
    error?: unknown,
  ) => {
    if (error) {
      console.warn("[persist] Failed to rehydrate state:", error)
      return
    }

    if (rehydratedState) {
      // Mark hydration as complete for components that need to wait
      // This is handled via the useStoreHydration hook pattern
      // Only log in non-test environments (vitest sets __vitest_worker__ global)
      if (!(globalThis as Record<string, unknown>).__vitest_worker__) {
        console.debug("[persist] State rehydrated successfully")
      }
    }
  }
}

/** Default collapsed state for status groups */
const DEFAULT_STATUS_COLLAPSED_STATE: Record<TaskGroup, boolean> = {
  open: false,
  deferred: true,
  closed: true,
}

/**
 * Migration function to handle schema version upgrades.
 * Migrates state from older versions to the current version.
 *
 * Version history:
 * - v1: Initial schema
 * - v2: Added statusCollapsedState and parentCollapsedState (consolidated from separate localStorage keys)
 * - v3: Added taskInputDraft and taskChatInputDraft (consolidated from separate localStorage keys)
 * - v4: Added vscodeThemeId, lastDarkThemeId, lastLightThemeId (consolidated from separate localStorage keys)
 * - v5: Added commentDrafts (per-task comment draft persistence)
 * - v6: Changed sidebarWidth and taskChatWidth from pixels to percentages of window width
 */
export function migrate(persistedState: unknown, version: number): PersistedState {
  let state = persistedState as PersistedState

  if (version < 2) {
    // Migrate from v1 to v2: Add collapsed states from separate localStorage keys
    let statusCollapsedState = DEFAULT_STATUS_COLLAPSED_STATE
    let parentCollapsedState: Record<string, boolean> = {}

    // Try to load from legacy localStorage keys
    try {
      const statusStored = localStorage.getItem(TASK_LIST_STATUS_STORAGE_KEY)
      if (statusStored) {
        const parsed = JSON.parse(statusStored) as Record<TaskGroup, boolean>
        statusCollapsedState = {
          open: parsed.open ?? DEFAULT_STATUS_COLLAPSED_STATE.open,
          deferred: parsed.deferred ?? DEFAULT_STATUS_COLLAPSED_STATE.deferred,
          closed: parsed.closed ?? DEFAULT_STATUS_COLLAPSED_STATE.closed,
        }
        // Remove the legacy key after migration
        localStorage.removeItem(TASK_LIST_STATUS_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    try {
      const parentStored = localStorage.getItem(TASK_LIST_PARENT_STORAGE_KEY)
      if (parentStored) {
        parentCollapsedState = JSON.parse(parentStored) as Record<string, boolean>
        // Remove the legacy key after migration
        localStorage.removeItem(TASK_LIST_PARENT_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    state = {
      ...state,
      statusCollapsedState,
      parentCollapsedState,
    }
  }

  if (version < 3) {
    // Migrate from v2 to v3: Add input draft states from separate localStorage keys
    let taskInputDraft = ""
    let taskChatInputDraft = ""

    // Try to load from legacy localStorage keys
    try {
      const taskInputStored = localStorage.getItem(TASK_INPUT_DRAFT_STORAGE_KEY)
      if (taskInputStored) {
        taskInputDraft = taskInputStored
        // Remove the legacy key after migration
        localStorage.removeItem(TASK_INPUT_DRAFT_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    try {
      const taskChatInputStored = localStorage.getItem(TASK_CHAT_INPUT_DRAFT_STORAGE_KEY)
      if (taskChatInputStored) {
        taskChatInputDraft = taskChatInputStored
        // Remove the legacy key after migration
        localStorage.removeItem(TASK_CHAT_INPUT_DRAFT_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    state = {
      ...state,
      taskInputDraft,
      taskChatInputDraft,
    }
  }

  if (version < 4) {
    // Migrate from v3 to v4: Add theme states from separate localStorage keys
    let theme = state.theme ?? "system"
    let vscodeThemeId: string | null = null
    let lastDarkThemeId: string | null = null
    let lastLightThemeId: string | null = null

    // Try to load from legacy localStorage keys
    try {
      const themeStored = localStorage.getItem(THEME_STORAGE_KEY)
      if (themeStored === "light" || themeStored === "dark" || themeStored === "system") {
        theme = themeStored
        // Remove the legacy key after migration
        localStorage.removeItem(THEME_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    try {
      const vscodeThemeStored = localStorage.getItem(VSCODE_THEME_STORAGE_KEY)
      if (vscodeThemeStored) {
        vscodeThemeId = vscodeThemeStored
        // Remove the legacy key after migration
        localStorage.removeItem(VSCODE_THEME_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    try {
      const lastDarkThemeStored = localStorage.getItem(LAST_DARK_THEME_STORAGE_KEY)
      if (lastDarkThemeStored) {
        lastDarkThemeId = lastDarkThemeStored
        // Remove the legacy key after migration
        localStorage.removeItem(LAST_DARK_THEME_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    try {
      const lastLightThemeStored = localStorage.getItem(LAST_LIGHT_THEME_STORAGE_KEY)
      if (lastLightThemeStored) {
        lastLightThemeId = lastLightThemeStored
        // Remove the legacy key after migration
        localStorage.removeItem(LAST_LIGHT_THEME_STORAGE_KEY)
      }
    } catch {
      // Ignore errors, use defaults
    }

    state = {
      ...state,
      theme,
      vscodeThemeId,
      lastDarkThemeId,
      lastLightThemeId,
    }
  }

  if (version < 5) {
    // Migrate from v4 to v5: Add commentDrafts (empty by default)
    state = {
      ...state,
      commentDrafts: {},
    }
  }

  if (version < 6) {
    // Migrate from v5 to v6: Convert panel widths from pixels to percentages
    // Use the current window width for conversion, or a reasonable default
    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1600

    // Only convert if values look like pixels (> 100, since percentages are 0-100)
    const sidebarWidth = state.sidebarWidth
    const taskChatWidth = state.taskChatWidth

    // Default percentages if we can't convert
    const defaultSidebarPercent = 20
    const defaultTaskChatPercent = 25

    state = {
      ...state,
      sidebarWidth:
        sidebarWidth > 100 ?
          Math.round((sidebarWidth / windowWidth) * 100)
        : (sidebarWidth ?? defaultSidebarPercent),
      taskChatWidth:
        taskChatWidth > 100 ?
          Math.round((taskChatWidth / windowWidth) * 100)
        : (taskChatWidth ?? defaultTaskChatPercent),
    }
  }

  return state
}

/**
 * Complete persist configuration for Zustand persist middleware.
 *
 * Example usage:
 * ```ts
 * import { persist } from 'zustand/middleware'
 * import { persistConfig } from './persist'
 *
 * const useAppStore = create<AppState & AppActions>()(
 *   persist(
 *     (set) => ({ ... }),
 *     persistConfig
 *   )
 * )
 * ```
 */
export const persistConfig: PersistOptions<AppState & AppActions, PersistedState> = {
  name: PERSIST_NAME,
  version: PERSIST_VERSION,
  storage,
  partialize,
  onRehydrateStorage,
  migrate,

  /**
   * Merge function to properly handle rehydration.
   * Deserializes the instances array back to a Map.
   * Note: Events are NOT restored here - they will be restored from IndexedDB by useStoreHydration.
   */
  merge: (persistedState: unknown, currentState: AppState & AppActions): AppState & AppActions => {
    const persisted = persistedState as PersistedState | undefined

    if (!persisted) {
      return currentState
    }

    // Deserialize instances from array back to Map
    const instances =
      Array.isArray(persisted.instances) && persisted.instances.length > 0 ?
        deserializeInstances(persisted.instances)
      : currentState.instances

    // Validate activeInstanceId exists in instances
    const activeInstanceId =
      persisted.activeInstanceId && instances.has(persisted.activeInstanceId) ?
        persisted.activeInstanceId
      : currentState.activeInstanceId

    return {
      ...currentState,
      ...persisted,
      // Restore Map from array
      instances,
      activeInstanceId,
    }
  },
}
