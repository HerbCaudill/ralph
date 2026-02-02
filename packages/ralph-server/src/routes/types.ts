import type { RalphRegistry, RalphInstanceState } from "../RalphRegistry.js"
import type { RalphStatus } from "../RalphManager.js"
import type { TaskChatManager } from "../TaskChatManager.js"
import type { TaskChatEventPersister } from "../TaskChatEventPersister.js"
import type { SessionStateStore } from "../SessionStateStore.js"
import type { SessionEventPersister } from "../SessionEventPersister.js"

/**
 * Context provided to agent route handlers via dependency injection.
 * This allows the routes to be mounted in any Express app without
 * relying on module-level singletons.
 */
export interface AgentRouteContext {
  /** Get the RalphRegistry singleton */
  getRalphRegistry: () => RalphRegistry

  /** Get the workspace path */
  getWorkspacePath: () => string

  /** Whether to log ralph events */
  logRalphEvents: boolean

  /** Whether dev mode is active */
  isDevMode: () => boolean

  /** Get the legacy singleton RalphManager (for backward compat) */
  getRalphManager: () => {
    isRunning: boolean
    status: RalphStatus
    canAcceptMessages: boolean
    start(sessions?: number): Promise<void>
    stop(): Promise<void>
    pause(): void
    resume(): void
    stopAfterCurrent(): void
    cancelStopAfterCurrent(): Promise<void>
    send(payload: unknown): void
  }

  /** Get the TaskChatManager for the active workspace */
  getTaskChatManager: () => TaskChatManager

  /** Get the TaskChatEventPersister for the active workspace */
  getTaskChatEventPersister: () => TaskChatEventPersister

  /** Get the active workspace context's event history */
  getEventHistory: () => unknown[]

  /** Set event history on the active context */
  setEventHistory: (events: unknown[]) => void
}

/**
 * Serialize a RalphInstanceState for API responses.
 * Excludes the RalphManager reference since it can't be serialized.
 */
export function serializeInstanceState(
  state: RalphInstanceState,
): Omit<RalphInstanceState, "manager"> & { status: RalphStatus } {
  return {
    id: state.id,
    name: state.name,
    agentName: state.agentName,
    worktreePath: state.worktreePath,
    workspaceId: state.workspaceId,
    branch: state.branch,
    createdAt: state.createdAt,
    currentTaskId: state.currentTaskId,
    currentTaskTitle: state.currentTaskTitle,
    status: state.manager.status,
    mergeConflict: state.mergeConflict,
  }
}
