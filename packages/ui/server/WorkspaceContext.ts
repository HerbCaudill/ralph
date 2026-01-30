import { EventEmitter } from "node:events"
import { RalphManager, type RalphEvent, type RalphStatus } from "./RalphManager.js"
import { BdProxy } from "./BdProxy.js"
import {
  TaskChatManager,
  type TaskChatEvent,
  type TaskChatMessage,
  type TaskChatStatus,
  type TaskChatToolUse,
} from "./TaskChatManager.js"
import { TaskChatEventLog } from "./TaskChatEventLog.js"
import { TaskChatEventPersister } from "./TaskChatEventPersister.js"
import { watchMutations } from "./BeadsClient.js"
import type { MutationEvent } from "@herbcaudill/beads-sdk"

/**  Maximum number of events to store in history buffer. */
const MAX_EVENT_HISTORY = 1000

/**  Options for creating a WorkspaceContext. */
export interface WorkspaceContextOptions {
  /** Workspace directory path (required) */
  workspacePath: string
  /** Run RalphManager in watch mode */
  watch?: boolean
  /** Additional environment variables */
  env?: Record<string, string>
  /** Enable logging of task chat events to file */
  enableTaskChatLogging?: boolean
  /** Enable polling for mutation events from beads daemon */
  enableMutationPolling?: boolean
  /** Mutation polling interval in ms (default: 1000) */
  mutationPollingInterval?: number
  /** Log ralph process events to console */
  logRalphEvents?: boolean
  /** Command to spawn Ralph CLI (default: "npx") */
  ralphCommand?: string
  /** Arguments for the Ralph CLI command (default: ["@herbcaudill/ralph", "--json"]) */
  ralphArgs?: string[]
}

/**
 * Encapsulates all state for a single workspace.
 *
 * Each workspace has its own:
 * - RalphManager (process management)
 * - BdProxy (issue database access)
 * - TaskChatManager (chat with Claude)
 * - Event history
 * - Current task tracking
 *
 * WorkspaceContext emits events that can be forwarded to WebSocket clients:
 * - "ralph:event" - Ralph event
 * - "ralph:status" - Ralph status change
 * - "ralph:output" - Non-JSON stdout line
 * - "ralph:error" - Ralph error
 * - "ralph:exit" - Ralph process exit
 * - "task-chat:message" - Chat message
 * - "task-chat:chunk" - Streaming chunk
 * - "task-chat:status" - Chat status change
 * - "task-chat:error" - Chat error
 * - "task-chat:tool_use" - Tool use started
 * - "task-chat:tool_update" - Tool use updated
 * - "task-chat:tool_result" - Tool use completed
 * - "mutation:event" - Mutation event from beads daemon
 */
export class WorkspaceContext extends EventEmitter {
  /** Workspace directory path */
  readonly workspacePath: string

  /** RalphManager instance for this workspace */
  private _ralphManager: RalphManager

  /** BdProxy instance for this workspace */
  private _bdProxy: BdProxy

  /** TaskChatManager instance for this workspace */
  private _taskChatManager: TaskChatManager

  /** TaskChatEventLog for persisting chat events (for replay testing) */
  private _taskChatEventLog: TaskChatEventLog | null = null

  /** TaskChatEventPersister for storing events for reconnection sync */
  private _taskChatEventPersister: TaskChatEventPersister

  /** Event history buffer */
  private _eventHistory: RalphEvent[] = []

  /** Current task being worked on */
  private _currentTaskId: string | undefined
  private _currentTaskTitle: string | undefined

  /** Whether this context has been disposed */
  private _disposed = false

  /** Cleanup function for mutation watcher (if enabled) */
  private _stopMutationWatcher: (() => void) | null = null

  /** Whether to log ralph events to console */
  private _logRalphEvents: boolean

  constructor(options: WorkspaceContextOptions) {
    super()
    this.workspacePath = options.workspacePath
    this._logRalphEvents = options.logRalphEvents ?? false

    // Create BdProxy
    this._bdProxy = new BdProxy({ cwd: options.workspacePath })

    // Create RalphManager and wire up events
    this._ralphManager = new RalphManager({
      cwd: options.workspacePath,
      watch: options.watch,
      env: options.env,
      command: options.ralphCommand,
      args: options.ralphArgs,
    })
    this.wireRalphManagerEvents()

    // Create TaskChatManager and wire up events
    this._taskChatManager = new TaskChatManager({
      cwd: options.workspacePath,
      env: options.env,
      getBdProxy: () => this._bdProxy,
    })
    this.wireTaskChatManagerEvents()

    // Create TaskChatEventLog if logging is enabled
    if (options.enableTaskChatLogging) {
      this._taskChatEventLog = new TaskChatEventLog({
        workspacePath: options.workspacePath,
      })
    }

    // Create TaskChatEventPersister for reconnection sync (always enabled)
    this._taskChatEventPersister = new TaskChatEventPersister(options.workspacePath)

    // Start mutation polling if enabled
    if (options.enableMutationPolling) {
      this.startMutationPolling(options.mutationPollingInterval)
    }
  }

  /**
   * Start polling for mutation events from the beads daemon.
   * Emits 'mutation:event' for each mutation detected.
   *
   * @param interval - Polling interval in ms (default: 1000)
   */
  startMutationPolling(interval: number = 1000): void {
    this.assertNotDisposed()

    // Stop existing watcher if any
    if (this._stopMutationWatcher) {
      this._stopMutationWatcher()
    }

    this._stopMutationWatcher = watchMutations(
      (event: MutationEvent) => {
        this.emit("mutation:event", event)
      },
      {
        workspacePath: this.workspacePath,
        interval,
      },
    )
  }

  /**
   * Stop polling for mutation events.
   */
  stopMutationPolling(): void {
    if (this._stopMutationWatcher) {
      this._stopMutationWatcher()
      this._stopMutationWatcher = null
    }
  }

  /**
   * Whether mutation polling is currently active.
   */
  get isMutationPollingActive(): boolean {
    return this._stopMutationWatcher !== null
  }

  /**
   * Get the RalphManager for this workspace.
   */
  get ralphManager(): RalphManager {
    this.assertNotDisposed()
    return this._ralphManager
  }

  /**
   * Get the BdProxy for this workspace.
   */
  get bdProxy(): BdProxy {
    this.assertNotDisposed()
    return this._bdProxy
  }

  /**
   * Get the TaskChatManager for this workspace.
   */
  get taskChatManager(): TaskChatManager {
    this.assertNotDisposed()
    return this._taskChatManager
  }

  /**
   * Get the TaskChatEventLog for this workspace (null if logging not enabled).
   */
  get taskChatEventLog(): TaskChatEventLog | null {
    return this._taskChatEventLog
  }

  /**
   * Get the TaskChatEventPersister for this workspace.
   * Used for reconnection sync to retrieve missed events.
   */
  get taskChatEventPersister(): TaskChatEventPersister {
    return this._taskChatEventPersister
  }

  /**
   * Get the event history for this workspace.
   */
  get eventHistory(): RalphEvent[] {
    return [...this._eventHistory]
  }

  /**
   * Get the current task being worked on.
   */
  get currentTask(): { taskId?: string; taskTitle?: string } {
    return {
      taskId: this._currentTaskId,
      taskTitle: this._currentTaskTitle,
    }
  }

  /**
   * Whether this context has been disposed.
   */
  get disposed(): boolean {
    return this._disposed
  }

  /**
   * Clear the event history and current task tracking.
   */
  clearHistory(): void {
    this.assertNotDisposed()
    this._eventHistory = []
    this._currentTaskId = undefined
    this._currentTaskTitle = undefined
  }

  /**
   * Set the event history (used for restoring events from disk on reconnect).
   */
  setEventHistory(events: RalphEvent[]): void {
    this.assertNotDisposed()
    this._eventHistory = [...events]
  }

  /**
   * Dispose of this context and release all resources.
   * Stops Ralph if running and removes all event listeners.
   */
  async dispose(): Promise<void> {
    if (this._disposed) {
      return
    }

    this._disposed = true

    // Stop Ralph if running
    if (this._ralphManager.isRunning || this._ralphManager.status === "paused") {
      try {
        await this._ralphManager.stop()
      } catch {
        // Ignore errors during cleanup
      }
    }

    // End any active logging session
    if (this._taskChatEventLog?.isLogging) {
      this._taskChatEventLog.endSession()
    }

    // Stop mutation polling
    this.stopMutationPolling()

    // Remove all listeners
    this._ralphManager.removeAllListeners()
    this._taskChatManager.removeAllListeners()

    // Clear history
    this._eventHistory = []
    this._currentTaskId = undefined
    this._currentTaskTitle = undefined
  }

  /**
   * Wire up RalphManager events to be emitted from this context.
   */
  private wireRalphManagerEvents(): void {
    this._ralphManager.on("event", (event: RalphEvent) => {
      // Log to console if enabled
      if (this._logRalphEvents) {
        console.log("[ralph-event]", JSON.stringify(event))
      }

      // Update current task tracking
      this.updateCurrentTask(event)

      // Add to history
      this.addEventToHistory(event)

      // Emit for broadcasting
      this.emit("ralph:event", event)
    })

    this._ralphManager.on("status", (status: RalphStatus) => {
      if (this._logRalphEvents) {
        console.log("[ralph-status]", status)
      }
      this.emit("ralph:status", status)
    })

    this._ralphManager.on("output", (line: string) => {
      if (this._logRalphEvents) {
        console.log("[ralph-output]", line)
      }
      this.emit("ralph:output", line)
    })

    this._ralphManager.on("error", (error: Error) => {
      if (this._logRalphEvents) {
        console.log("[ralph-error]", error.message)
      }
      this.emit("ralph:error", error)
    })

    this._ralphManager.on("exit", (info: { code: number | null; signal: string | null }) => {
      if (this._logRalphEvents) {
        console.log("[ralph-exit]", `code=${info.code} signal=${info.signal}`)
      }
      this.emit("ralph:exit", info)
    })
  }

  /**
   * Wire up TaskChatManager events to be emitted from this context.
   */
  private wireTaskChatManagerEvents(): void {
    this._taskChatManager.on("message", (message: TaskChatMessage) => {
      this.emit("task-chat:message", message)
    })

    this._taskChatManager.on("chunk", (text: string) => {
      this.emit("task-chat:chunk", text)
    })

    this._taskChatManager.on("status", (status: TaskChatStatus) => {
      this.emit("task-chat:status", status)
      // Start/end logging sessions based on status changes
      this.handleTaskChatStatusForLogging(status)
    })

    this._taskChatManager.on("error", (error: Error) => {
      this.emit("task-chat:error", error)
    })

    this._taskChatManager.on("tool_use", (toolUse: TaskChatToolUse) => {
      this.emit("task-chat:tool_use", toolUse)
    })

    this._taskChatManager.on("tool_update", (toolUse: TaskChatToolUse) => {
      this.emit("task-chat:tool_update", toolUse)
    })

    this._taskChatManager.on("tool_result", (toolUse: TaskChatToolUse) => {
      this.emit("task-chat:tool_result", toolUse)
    })

    // Emit raw SDK events for unified event model
    this._taskChatManager.on("event", (event: TaskChatEvent) => {
      this.emit("task-chat:event", event)
      // Persist for reconnection sync
      this.persistTaskChatEvent(event)
      // Also log for replay testing
      this.logTaskChatEvent(event)
    })

    // Emit historyCleared event for cross-client sync
    this._taskChatManager.on("historyCleared", () => {
      this.emit("task-chat:cleared")
      // Clear persisted events
      this.clearPersistedTaskChatEvents()
    })
  }

  /**
   * Handle status changes for logging sessions.
   * Starts a logging session when processing begins.
   */
  private handleTaskChatStatusForLogging(status: TaskChatStatus): void {
    if (!this._taskChatEventLog) return

    if (status === "processing" && !this._taskChatEventLog.isLogging) {
      // Start a new logging session when processing begins
      this._taskChatEventLog.startSession().catch(err => {
        console.error("[task-chat-log] Failed to start logging session:", err)
      })
    }
    // Note: We don't end the session on idle/error - the session continues
    // so we can capture the full conversation. Call endSession() explicitly
    // or dispose() to end logging.
  }

  /**
   * Log a task chat event to the event log (if logging is enabled and session is active).
   */
  private logTaskChatEvent(event: TaskChatEvent): void {
    if (!this._taskChatEventLog?.isLogging) return

    this._taskChatEventLog.log(event).catch(err => {
      console.error("[task-chat-log] Failed to log event:", err)
    })
  }

  /**
   * Persist a task chat event for reconnection sync.
   * Uses "default" as the instance ID since task chat is workspace-scoped.
   */
  private persistTaskChatEvent(event: TaskChatEvent): void {
    this._taskChatEventPersister.appendEvent("default", event).catch(err => {
      console.error("[task-chat-persist] Failed to persist event:", err)
    })
  }

  /**
   * Clear persisted task chat events (called when history is cleared).
   */
  private clearPersistedTaskChatEvents(): void {
    this._taskChatEventPersister.clear("default").catch(err => {
      console.error("[task-chat-persist] Failed to clear events:", err)
    })
  }

  /**
   * Add an event to the history buffer.
   */
  private addEventToHistory(event: RalphEvent): void {
    this._eventHistory.push(event)
    // Trim to max size
    if (this._eventHistory.length > MAX_EVENT_HISTORY) {
      this._eventHistory = this._eventHistory.slice(-MAX_EVENT_HISTORY)
    }
  }

  /**
   * Update the current task based on task lifecycle events.
   */
  private updateCurrentTask(event: RalphEvent): void {
    if (event.type === "ralph_task_started") {
      this._currentTaskId = event.taskId as string | undefined
      this._currentTaskTitle = event.taskTitle as string | undefined
    } else if (event.type === "ralph_task_completed") {
      // Clear current task when completed
      this._currentTaskId = undefined
      this._currentTaskTitle = undefined
    }
  }

  /**
   * Assert that this context has not been disposed.
   */
  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error("WorkspaceContext has been disposed")
    }
  }
}
