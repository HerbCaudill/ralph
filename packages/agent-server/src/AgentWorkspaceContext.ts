import { EventEmitter } from "node:events"
import {
  RalphManager,
  type RalphEvent,
  type RalphStatus,
  type RalphManagerOptions,
} from "./RalphManager.js"
import {
  TaskChatManager,
  type TaskChatEvent,
  type TaskChatMessage,
  type TaskChatStatus,
  type TaskChatToolUse,
  type TaskChatManagerOptions,
} from "./TaskChatManager.js"
import { TaskChatEventLog, type TaskChatEventLogOptions } from "./TaskChatEventLog.js"
import { TaskChatEventPersister } from "./TaskChatEventPersister.js"
import type { BdProxy } from "./agentTypes.js"

/**  Maximum number of events to store in history buffer. */
const MAX_EVENT_HISTORY = 1000

/**  Options for creating an AgentWorkspaceContext. */
export interface AgentWorkspaceContextOptions {
  /** Workspace directory path (required) */
  workspacePath: string
  /** Run RalphManager in watch mode */
  watch?: boolean
  /** Additional environment variables */
  env?: Record<string, string>
  /** Enable logging of task chat events to file */
  enableTaskChatLogging?: boolean
  /** Log ralph process events to console */
  logRalphEvents?: boolean
  /** Command to spawn Ralph CLI (default: "npx") */
  ralphCommand?: string
  /** Arguments for the Ralph CLI command (default: ["@herbcaudill/ralph", "--json"]) */
  ralphArgs?: string[]
  /** Function to get the BdProxy (for task chat context) */
  getBdProxy?: () => BdProxy
}

/**
 * Encapsulates agent-specific state for a single workspace.
 *
 * This is the agent-server's half of the workspace context, containing:
 * - RalphManager (agent process management)
 * - TaskChatManager (chat with Claude)
 * - TaskChatEventLog/Persister (event persistence)
 * - Event history
 * - Current task tracking
 *
 * The beads-specific half (BdProxy, mutation watcher) stays in the UI server
 * or beads-server package.
 *
 * Events emitted:
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
 * - "task-chat:event" - Raw SDK event
 * - "task-chat:cleared" - History cleared
 */
export class AgentWorkspaceContext extends EventEmitter {
  /** Workspace directory path */
  readonly workspacePath: string

  /** RalphManager instance for this workspace */
  private _ralphManager: RalphManager

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

  /** Whether to log ralph events to console */
  private _logRalphEvents: boolean

  constructor(options: AgentWorkspaceContextOptions) {
    super()
    this.workspacePath = options.workspacePath
    this._logRalphEvents = options.logRalphEvents ?? false

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
    const taskChatOpts: TaskChatManagerOptions = {
      cwd: options.workspacePath,
      env: options.env,
    }
    if (options.getBdProxy) {
      taskChatOpts.getBdProxy = options.getBdProxy
    }
    this._taskChatManager = new TaskChatManager(taskChatOpts)
    this.wireTaskChatManagerEvents()

    // Create TaskChatEventLog if logging is enabled
    if (options.enableTaskChatLogging) {
      this._taskChatEventLog = new TaskChatEventLog({
        workspacePath: options.workspacePath,
      })
    }

    // Create TaskChatEventPersister for reconnection sync (always enabled)
    this._taskChatEventPersister = new TaskChatEventPersister(options.workspacePath)
  }

  /**
   * Get the RalphManager for this workspace.
   */
  get ralphManager(): RalphManager {
    this.assertNotDisposed()
    return this._ralphManager
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
      if (this._logRalphEvents) {
        console.log("[ralph-event]", JSON.stringify(event))
      }
      this.updateCurrentTask(event)
      this.addEventToHistory(event)
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

    this._taskChatManager.on("event", (event: TaskChatEvent) => {
      this.emit("task-chat:event", event)
      this.persistTaskChatEvent(event)
      this.logTaskChatEvent(event)
    })

    this._taskChatManager.on("historyCleared", () => {
      this.emit("task-chat:cleared")
      this.clearPersistedTaskChatEvents()
    })
  }

  private handleTaskChatStatusForLogging(status: TaskChatStatus): void {
    if (!this._taskChatEventLog) return

    if (status === "processing" && !this._taskChatEventLog.isLogging) {
      this._taskChatEventLog.startSession().catch(err => {
        console.error("[task-chat-log] Failed to start logging session:", err)
      })
    }
  }

  private logTaskChatEvent(event: TaskChatEvent): void {
    if (!this._taskChatEventLog?.isLogging) return

    this._taskChatEventLog.log(event).catch(err => {
      console.error("[task-chat-log] Failed to log event:", err)
    })
  }

  private persistTaskChatEvent(event: TaskChatEvent): void {
    this._taskChatEventPersister.appendEvent("default", event).catch(err => {
      console.error("[task-chat-persist] Failed to persist event:", err)
    })
  }

  private clearPersistedTaskChatEvents(): void {
    this._taskChatEventPersister.clear("default").catch(err => {
      console.error("[task-chat-persist] Failed to clear events:", err)
    })
  }

  private addEventToHistory(event: RalphEvent): void {
    this._eventHistory.push(event)
    if (this._eventHistory.length > MAX_EVENT_HISTORY) {
      this._eventHistory = this._eventHistory.slice(-MAX_EVENT_HISTORY)
    }
  }

  private updateCurrentTask(event: RalphEvent): void {
    if (event.type === "ralph_task_started") {
      this._currentTaskId = event.taskId as string | undefined
      this._currentTaskTitle = event.taskTitle as string | undefined
    } else if (event.type === "ralph_task_completed") {
      this._currentTaskId = undefined
      this._currentTaskTitle = undefined
    }
  }

  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error("AgentWorkspaceContext has been disposed")
    }
  }
}
