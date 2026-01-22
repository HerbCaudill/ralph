import { EventEmitter } from "node:events"
import {
  RalphManager,
  type RalphManagerOptions,
  type RalphEvent,
  type RalphStatus,
} from "./RalphManager.js"
import { type IterationStateStore, type PersistedIterationState } from "./IterationStateStore.js"
import type { ConversationContext, ConversationMessage } from "./ClaudeAdapter.js"

/**
 * Information about a merge conflict for an instance.
 */
export interface MergeConflict {
  /** Files with conflicts that need resolution */
  files: string[]
  /** Branch being merged from */
  sourceBranch: string
  /** Timestamp when the conflict was detected */
  timestamp: number
}

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

  /** Merge conflict info if instance is paused due to conflicts (null if no conflict) */
  mergeConflict: MergeConflict | null
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

  /** Optional IterationStateStore for persisting iteration state */
  iterationStateStore?: IterationStateStore
}

/**
 * Convert RalphEvent[] to ConversationContext.
 *
 * This extracts conversation messages from the event stream to create
 * a serializable context that can be persisted and restored.
 *
 * Event types handled:
 * - user_message: User's input message
 * - message: Assistant text response (from normalized events)
 * - content_block_start/delta: Streaming text (accumulated into messages)
 * - tool_use: Tool invocation
 * - tool_result: Tool result
 * - result: Final iteration result (contains usage stats)
 */
export function eventsToConversationContext(events: RalphEvent[]): ConversationContext {
  const messages: ConversationMessage[] = []
  let lastPrompt: string | undefined
  let currentAssistantContent = ""
  let currentAssistantTimestamp = 0
  let currentToolUses: ConversationMessage["toolUses"] = []
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  for (const event of events) {
    switch (event.type) {
      case "user_message": {
        // Flush any pending assistant message
        if (currentAssistantContent || (currentToolUses && currentToolUses.length > 0)) {
          messages.push({
            role: "assistant",
            content: currentAssistantContent,
            timestamp: currentAssistantTimestamp || event.timestamp,
            toolUses: currentToolUses.length > 0 ? currentToolUses : undefined,
          })
          currentAssistantContent = ""
          currentAssistantTimestamp = 0
          currentToolUses = []
        }

        // Add user message
        const content = (event.message as string) || (event.content as string) || ""
        if (content) {
          messages.push({
            role: "user",
            content,
            timestamp: event.timestamp,
          })
          lastPrompt = content
        }
        break
      }

      case "message": {
        // Normalized message event from AgentAdapter
        const content = (event.content as string) || ""
        const isPartial = event.isPartial as boolean
        if (!isPartial && content) {
          currentAssistantContent = content
          currentAssistantTimestamp = event.timestamp
        } else if (isPartial) {
          currentAssistantContent += content
          if (!currentAssistantTimestamp) {
            currentAssistantTimestamp = event.timestamp
          }
        }
        break
      }

      case "content_block_start":
      case "content_block_delta": {
        // Streaming text from Claude SDK native events
        const contentBlock = event.content_block as { type?: string; text?: string } | undefined
        const delta = event.delta as { type?: string; text?: string } | undefined
        if (contentBlock?.type === "text" || delta?.type === "text_delta") {
          const text = contentBlock?.text || delta?.text || ""
          currentAssistantContent += text
          if (!currentAssistantTimestamp) {
            currentAssistantTimestamp = event.timestamp
          }
        }
        break
      }

      case "assistant": {
        // Legacy event type for complete assistant message
        const content = (event.content as string) || (event.text as string) || ""
        if (content) {
          currentAssistantContent = content
          currentAssistantTimestamp = event.timestamp
        }
        break
      }

      case "tool_use": {
        // Tool invocation
        const toolUse = {
          id: (event.toolUseId as string) || (event.id as string) || "",
          name: (event.tool as string) || (event.name as string) || "",
          input: (event.input as Record<string, unknown>) || {},
        }
        if (toolUse.id && toolUse.name) {
          currentToolUses.push(toolUse)
          if (!currentAssistantTimestamp) {
            currentAssistantTimestamp = event.timestamp
          }
        }
        break
      }

      case "tool_result": {
        // Tool result - update the matching tool use
        const toolUseId = (event.toolUseId as string) || (event.id as string) || ""
        const output = (event.output as string) || (event.result as string)
        const error = event.error as string | undefined
        const isError = (event.isError as boolean) || !!error

        const toolUse = currentToolUses.find(t => t.id === toolUseId)
        if (toolUse) {
          toolUse.result = {
            output,
            error,
            isError,
          }
        }
        break
      }

      case "result": {
        // Final result with usage stats
        const eventUsage = event.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined
        if (eventUsage) {
          usage.inputTokens += eventUsage.input_tokens || 0
          usage.outputTokens += eventUsage.output_tokens || 0
          usage.totalTokens = usage.inputTokens + usage.outputTokens
        }
        break
      }

      case "message_start": {
        // SDK message start may contain usage info
        const messageUsage = (event.message as { usage?: { input_tokens?: number } })?.usage
        if (messageUsage) {
          usage.inputTokens += messageUsage.input_tokens || 0
          usage.totalTokens = usage.inputTokens + usage.outputTokens
        }
        break
      }

      case "message_delta": {
        // SDK message delta may contain final usage info
        const deltaUsage = event.usage as { output_tokens?: number } | undefined
        if (deltaUsage) {
          usage.outputTokens += deltaUsage.output_tokens || 0
          usage.totalTokens = usage.inputTokens + usage.outputTokens
        }
        break
      }
    }
  }

  // Flush any remaining assistant content
  if (currentAssistantContent || (currentToolUses && currentToolUses.length > 0)) {
    messages.push({
      role: "assistant",
      content: currentAssistantContent,
      timestamp: currentAssistantTimestamp || Date.now(),
      toolUses: currentToolUses.length > 0 ? currentToolUses : undefined,
    })
  }

  return {
    messages,
    lastPrompt,
    usage,
    timestamp: Date.now(),
  }
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

  /** Optional IterationStateStore for persisting iteration state */
  private _iterationStateStore: IterationStateStore | null = null

  /** Track pending save operations to avoid concurrent writes */
  private _pendingSaves = new Map<string, Promise<void>>()

  constructor(options: RalphRegistryOptions = {}) {
    super()
    this._defaultManagerOptions = options.defaultManagerOptions ?? {}
    this._maxInstances = options.maxInstances ?? 10
    this._iterationStateStore = options.iterationStateStore ?? null
  }

  /**
   * Set the IterationStateStore for persisting iteration state.
   * Can be called after construction to add state persistence.
   *
   * @param store - The IterationStateStore to use, or null to disable persistence
   */
  setIterationStateStore(store: IterationStateStore | null): void {
    this._iterationStateStore = store
  }

  /**
   * Get the current IterationStateStore, if any.
   */
  getIterationStateStore(): IterationStateStore | null {
    return this._iterationStateStore
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
      mergeConflict: null,
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
   * Set a merge conflict on an instance.
   *
   * @param instanceId - The instance ID
   * @param conflict - The merge conflict info, or null to clear
   */
  setMergeConflict(instanceId: string, conflict: MergeConflict | null): void {
    const state = this._instances.get(instanceId)
    if (!state) {
      return
    }
    state.mergeConflict = conflict
    this.emit("instance:merge_conflict", instanceId, conflict)
  }

  /**
   * Get the merge conflict for an instance.
   *
   * @param instanceId - The instance ID
   * @returns The merge conflict info, or undefined if instance not found
   */
  getMergeConflict(instanceId: string): MergeConflict | null | undefined {
    const state = this._instances.get(instanceId)
    if (!state) {
      return undefined
    }
    return state.mergeConflict
  }

  /**
   * Save the current iteration state for an instance.
   *
   * This captures the current conversation context (derived from event history),
   * status, and task info, and persists it to the IterationStateStore.
   *
   * If no IterationStateStore is configured, this is a no-op.
   *
   * @param instanceId - The instance ID
   * @returns Promise that resolves when save is complete
   */
  async saveIterationState(instanceId: string): Promise<void> {
    if (!this._iterationStateStore) {
      return
    }

    const state = this._instances.get(instanceId)
    if (!state) {
      return
    }

    // Avoid concurrent saves for the same instance
    const pendingSave = this._pendingSaves.get(instanceId)
    if (pendingSave) {
      await pendingSave
    }

    const savePromise = this.doSaveIterationState(instanceId, state)
    this._pendingSaves.set(instanceId, savePromise)

    try {
      await savePromise
    } finally {
      this._pendingSaves.delete(instanceId)
    }
  }

  /**
   * Internal method to perform the actual state save.
   */
  private async doSaveIterationState(instanceId: string, state: RalphInstanceState): Promise<void> {
    if (!this._iterationStateStore) {
      return
    }

    const events = this._eventHistory.get(instanceId) ?? []
    const conversationContext = eventsToConversationContext(events)

    const persistedState: PersistedIterationState = {
      instanceId,
      conversationContext,
      status: state.manager.status,
      currentTaskId: state.currentTaskId,
      savedAt: Date.now(),
      version: 1,
    }

    try {
      await this._iterationStateStore.save(persistedState)
    } catch (err) {
      console.error(`[RalphRegistry] Failed to save iteration state for ${instanceId}:`, err)
    }
  }

  /**
   * Delete the persisted iteration state for an instance.
   *
   * Call this when an iteration completes successfully or when
   * the instance is disposed.
   *
   * @param instanceId - The instance ID
   * @returns Promise that resolves to true if state was deleted, false if not found
   */
  async deleteIterationState(instanceId: string): Promise<boolean> {
    if (!this._iterationStateStore) {
      return false
    }

    try {
      return await this._iterationStateStore.delete(instanceId)
    } catch (err) {
      console.error(`[RalphRegistry] Failed to delete iteration state for ${instanceId}:`, err)
      return false
    }
  }

  /**
   * Load persisted iteration state for an instance.
   *
   * @param instanceId - The instance ID
   * @returns The persisted state, or null if not found
   */
  async loadIterationState(instanceId: string): Promise<PersistedIterationState | null> {
    if (!this._iterationStateStore) {
      return null
    }

    try {
      return await this._iterationStateStore.load(instanceId)
    } catch (err) {
      console.error(`[RalphRegistry] Failed to load iteration state for ${instanceId}:`, err)
      return null
    }
  }

  /**
   * Save iteration state for all running instances.
   *
   * Useful for graceful shutdown to ensure all state is persisted.
   *
   * @returns Promise that resolves when all saves are complete
   */
  async saveAllIterationStates(): Promise<void> {
    if (!this._iterationStateStore) {
      return
    }

    const savePromises: Promise<void>[] = []

    for (const state of this._instances.values()) {
      // Only save for instances that are running or paused (have active state)
      if (state.manager.status === "running" || state.manager.status === "paused") {
        savePromises.push(this.saveIterationState(state.id))
      }
    }

    await Promise.all(savePromises)
  }

  /**
   * Dispose of an instance, stopping its RalphManager.
   *
   * Before disposal, saves the iteration state (if store is configured)
   * to enable potential restoration later.
   *
   * @param instanceId - The instance ID
   */
  async dispose(instanceId: string): Promise<void> {
    const state = this._instances.get(instanceId)
    if (!state) {
      return
    }

    // Save iteration state before stopping (for graceful shutdown)
    if (state.manager.isRunning || state.manager.status === "paused") {
      await this.saveIterationState(instanceId)
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
    this._pendingSaves.delete(instanceId)

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
   *
   * Also sets up automatic iteration state saving at key points:
   * - After iteration completion events (result, ralph_task_completed)
   * - On status changes (paused, stopped)
   * - Before process exit
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

      // Auto-save iteration state after key events
      // - result: iteration/turn completed successfully
      // - ralph_task_completed: task completed
      // - message_stop: assistant message completed
      if (
        event.type === "result" ||
        event.type === "ralph_task_completed" ||
        event.type === "message_stop"
      ) {
        this.saveIterationState(id).catch(err => {
          console.error(`[RalphRegistry] Auto-save failed for ${id} after ${event.type}:`, err)
        })
      }
    })

    manager.on("status", (status: RalphStatus) => {
      this.emit("instance:event", id, "ralph:status", status)

      // Auto-save when paused or stopping (but not when fully stopped - exit handles that)
      if (status === "paused" || status === "stopping_after_current") {
        this.saveIterationState(id).catch(err => {
          console.error(`[RalphRegistry] Auto-save failed for ${id} on status ${status}:`, err)
        })
      }

      // Delete iteration state when iteration completes normally (stopped state)
      // This is optional - we could keep it for debugging/replay purposes
      // For now, we keep it to allow restoration on reconnect
    })

    manager.on("output", (line: string) => {
      this.emit("instance:event", id, "ralph:output", line)
    })

    manager.on("error", (error: Error) => {
      this.emit("instance:event", id, "ralph:error", error)

      // Save state on error to preserve context for debugging/retry
      this.saveIterationState(id).catch(err => {
        console.error(`[RalphRegistry] Auto-save failed for ${id} on error:`, err)
      })
    })

    manager.on("exit", (info: { code: number | null; signal: string | null }) => {
      // Save state before emitting exit event
      // This ensures state is captured even for unexpected exits
      this.saveIterationState(id)
        .catch(err => {
          console.error(`[RalphRegistry] Auto-save failed for ${id} on exit:`, err)
        })
        .finally(() => {
          this.emit("instance:event", id, "ralph:exit", info)
        })
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
