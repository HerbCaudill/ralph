import { EventEmitter } from "node:events"
import {
  RalphManager,
  type RalphManagerOptions,
  type RalphEvent,
  type RalphStatus,
} from "./RalphManager.js"

/**
 * State for a registered Ralph instance.
 */
export interface RalphInstanceState {
  /** Unique instance ID */
  id: string

  /** Display name for the instance */
  name: string

  /** Agent name for task assignment (e.g., "Ralph-1") */
  agentName: string

  /** The RalphManager for this instance */
  manager: RalphManager

  /** Path to the git worktree (null for main workspace) */
  worktreePath: string | null

  /** Git branch name for this instance */
  branch: string | null

  /** Timestamp when the instance was created */
  createdAt: number

  /** ID of the current task being worked on */
  currentTaskId: string | null

  /** Title of the current task being worked on */
  currentTaskTitle: string | null
}

/**
 * Options for creating a new Ralph instance.
 */
export interface CreateInstanceOptions {
  /** Unique instance ID */
  id: string

  /** Display name for the instance */
  name: string

  /** Agent name for task assignment */
  agentName: string

  /** Path to the git worktree (null for main workspace) */
  worktreePath: string | null

  /** Git branch name for this instance */
  branch: string | null

  /** RalphManager options (cwd, env, etc.) */
  managerOptions?: Omit<RalphManagerOptions, "cwd">
}

/**
 * Options for creating a RalphRegistry.
 */
export interface RalphRegistryOptions {
  /** Default options for new RalphManager instances */
  defaultManagerOptions?: Omit<RalphManagerOptions, "cwd">

  /** Maximum number of instances (0 = unlimited). Default: 10 */
  maxInstances?: number
}

/**
 * Manages multiple RalphManager instances keyed by instance ID.
 *
 * Replaces the singleton RalphManager pattern to support concurrent Ralph
 * instances running in different git worktrees.
 *
 * Events:
 * - "instance:created" - New instance was created (instanceId, state)
 * - "instance:disposed" - Instance was disposed (instanceId)
 * - "instance:event" - Event from any instance (instanceId, eventType, ...args)
 *
 * Per-instance events forwarded:
 * - "ralph:event" - Ralph JSON event
 * - "ralph:status" - Status change
 * - "ralph:output" - Non-JSON stdout line
 * - "ralph:error" - Error
 * - "ralph:exit" - Process exit
 */
export class RalphRegistry extends EventEmitter {
  /** Map of instance IDs to their state */
  private _instances = new Map<string, RalphInstanceState>()

  /** Default options for new managers */
  private _defaultManagerOptions: Omit<RalphManagerOptions, "cwd">

  /** Maximum number of instances (0 = unlimited) */
  private _maxInstances: number

  /** Event history per instance */
  private _eventHistory = new Map<string, RalphEvent[]>()

  /** Maximum events to keep per instance */
  private static readonly MAX_EVENT_HISTORY = 1000

  constructor(options: RalphRegistryOptions = {}) {
    super()
    this._defaultManagerOptions = options.defaultManagerOptions ?? {}
    this._maxInstances = options.maxInstances ?? 10
  }

  /**
   * Create and register a new Ralph instance.
   *
   * @param options - Options for creating the instance
   * @returns The created instance state
   * @throws Error if an instance with the same ID already exists
   */
  create(options: CreateInstanceOptions): RalphInstanceState {
    if (this._instances.has(options.id)) {
      throw new Error(`Instance with ID '${options.id}' already exists`)
    }

    // Determine the working directory
    const cwd = options.worktreePath ?? process.cwd()

    // Create the RalphManager
    const managerOptions: RalphManagerOptions = {
      ...this._defaultManagerOptions,
      ...options.managerOptions,
      cwd,
    }
    const manager = new RalphManager(managerOptions)

    // Create the instance state
    const state: RalphInstanceState = {
      id: options.id,
      name: options.name,
      agentName: options.agentName,
      manager,
      worktreePath: options.worktreePath,
      branch: options.branch,
      createdAt: Date.now(),
      currentTaskId: null,
      currentTaskTitle: null,
    }

    // Initialize event history for this instance
    this._eventHistory.set(options.id, [])

    // Wire up event forwarding
    this.wireManagerEvents(state)

    // Register the instance
    this._instances.set(options.id, state)

    // Emit creation event
    this.emit("instance:created", options.id, state)

    // Enforce max instances limit
    this.enforceMaxInstances()

    return state
  }

  /**
   * Get an instance by ID.
   *
   * @param instanceId - The instance ID
   * @returns The instance state, or undefined if not found
   */
  get(instanceId: string): RalphInstanceState | undefined {
    return this._instances.get(instanceId)
  }

  /**
   * Check if an instance exists.
   *
   * @param instanceId - The instance ID
   * @returns True if the instance exists
   */
  has(instanceId: string): boolean {
    return this._instances.has(instanceId)
  }

  /**
   * Get all instance IDs.
   *
   * @returns Array of instance IDs
   */
  getInstanceIds(): string[] {
    return Array.from(this._instances.keys())
  }

  /**
   * Get all instance states.
   *
   * @returns Array of instance states
   */
  getAll(): RalphInstanceState[] {
    return Array.from(this._instances.values())
  }

  /**
   * Get the number of registered instances.
   */
  get size(): number {
    return this._instances.size
  }

  /**
   * Get the event history for an instance.
   *
   * @param instanceId - The instance ID
   * @returns Array of events, or empty array if instance not found
   */
  getEventHistory(instanceId: string): RalphEvent[] {
    return [...(this._eventHistory.get(instanceId) ?? [])]
  }

  /**
   * Clear the event history for an instance.
   *
   * @param instanceId - The instance ID
   */
  clearEventHistory(instanceId: string): void {
    const history = this._eventHistory.get(instanceId)
    if (history) {
      history.length = 0
    }
  }

  /**
   * Get the current task for an instance.
   *
   * @param instanceId - The instance ID
   * @returns The current task info, or undefined if instance not found
   */
  getCurrentTask(
    instanceId: string,
  ): { taskId: string | null; taskTitle: string | null } | undefined {
    const state = this._instances.get(instanceId)
    if (!state) {
      return undefined
    }
    return {
      taskId: state.currentTaskId,
      taskTitle: state.currentTaskTitle,
    }
  }

  /**
   * Dispose of an instance, stopping its RalphManager.
   *
   * @param instanceId - The instance ID
   */
  async dispose(instanceId: string): Promise<void> {
    const state = this._instances.get(instanceId)
    if (!state) {
      return
    }

    // Stop the manager if running
    if (state.manager.isRunning || state.manager.status === "paused") {
      try {
        await state.manager.stop()
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Remove all listeners from the manager
    state.manager.removeAllListeners()

    // Remove from registry
    this._instances.delete(instanceId)
    this._eventHistory.delete(instanceId)

    // Emit disposal event
    this.emit("instance:disposed", instanceId)
  }

  /**
   * Dispose of all instances.
   */
  async disposeAll(): Promise<void> {
    const disposals = Array.from(this._instances.keys()).map(id => this.dispose(id))
    await Promise.all(disposals)
  }

  /**
   * Wire up event forwarding from a RalphManager.
   */
  private wireManagerEvents(state: RalphInstanceState): void {
    const { id, manager } = state

    manager.on("event", (event: RalphEvent) => {
      // Update current task tracking
      this.updateCurrentTask(state, event)

      // Add to history
      this.addEventToHistory(id, event)

      // Forward event
      this.emit("instance:event", id, "ralph:event", event)
    })

    manager.on("status", (status: RalphStatus) => {
      this.emit("instance:event", id, "ralph:status", status)
    })

    manager.on("output", (line: string) => {
      this.emit("instance:event", id, "ralph:output", line)
    })

    manager.on("error", (error: Error) => {
      this.emit("instance:event", id, "ralph:error", error)
    })

    manager.on("exit", (info: { code: number | null; signal: string | null }) => {
      this.emit("instance:event", id, "ralph:exit", info)
    })
  }

  /**
   * Add an event to the history for an instance.
   */
  private addEventToHistory(instanceId: string, event: RalphEvent): void {
    const history = this._eventHistory.get(instanceId)
    if (!history) {
      return
    }

    history.push(event)

    // Trim to max size
    if (history.length > RalphRegistry.MAX_EVENT_HISTORY) {
      history.splice(0, history.length - RalphRegistry.MAX_EVENT_HISTORY)
    }
  }

  /**
   * Update the current task based on task lifecycle events.
   */
  private updateCurrentTask(state: RalphInstanceState, event: RalphEvent): void {
    if (event.type === "ralph_task_started") {
      state.currentTaskId = (event.taskId as string) ?? null
      state.currentTaskTitle = (event.taskTitle as string) ?? null
    } else if (event.type === "ralph_task_completed") {
      state.currentTaskId = null
      state.currentTaskTitle = null
    }
  }

  /**
   * Enforce the maximum instances limit by disposing stopped instances first.
   * If all instances are running, dispose the oldest one.
   */
  private enforceMaxInstances(): void {
    if (this._maxInstances <= 0) {
      return // Unlimited
    }

    if (this._instances.size <= this._maxInstances) {
      return
    }

    // Find instances to dispose, preferring stopped ones
    const instances = Array.from(this._instances.values())
    const stoppedInstances = instances.filter(s => s.manager.status === "stopped")

    if (stoppedInstances.length > 0) {
      // Dispose the oldest stopped instance
      const oldest = stoppedInstances.sort((a, b) => a.createdAt - b.createdAt)[0]
      this.dispose(oldest.id).catch(() => {
        // Ignore dispose errors
      })
    } else {
      // All instances running - dispose the oldest one
      const oldest = instances.sort((a, b) => a.createdAt - b.createdAt)[0]
      this.dispose(oldest.id).catch(() => {
        // Ignore dispose errors
      })
    }
  }
}
