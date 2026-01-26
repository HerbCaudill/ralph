import { EventEmitter } from "node:events"
import { WorkspaceContext, type WorkspaceContextOptions } from "./WorkspaceContext.js"

/**
 * Manages multiple WorkspaceContext instances.
 *
 * Provides a registry pattern for managing workspace contexts, replacing
 * the singleton pattern used previously. Each workspace has its own context
 * with isolated state for RalphManager, BdProxy, TaskChatManager, and event history.
 *
 * Events:
 * - "context:created" - New context was created (workspacePath, context)
 * - "context:activated" - Context became active (workspacePath, context)
 * - "context:disposed" - Context was disposed (workspacePath)
 * - "context:event" - Event from any context (workspacePath, eventType, ...args)
 *
 * The manager forwards all events from the active context. When the active context
 * changes, events from the old context are no longer forwarded.
 */
export class WorkspaceContextManager extends EventEmitter {
  /** Map of workspace paths to their contexts */
  private _contexts = new Map<string, WorkspaceContext>()

  /** The currently active workspace path */
  private _activeWorkspacePath: string | undefined

  /** Default options for creating new contexts */
  private _defaultOptions: WorkspaceContextManagerOptions

  /** Maximum number of contexts to keep (0 = unlimited) */
  private _maxContexts: number

  /** Event handler bound to current active context (for cleanup) */
  private _boundEventHandler: ((eventType: string, ...args: unknown[]) => void) | null = null

  constructor(
    /** Configuration options for the manager */
    options: WorkspaceContextManagerOptions = {},
  ) {
    super()
    this._defaultOptions = options
    this._maxContexts = options.maxContexts ?? 10
  }

  /**
   * Get a context for the given workspace path, creating it if it doesn't exist.
   * Does NOT change the active context - use setActiveContext() for that.
   */
  getOrCreate(
    /** The workspace path */
    workspacePath: string,
  ): WorkspaceContext {
    let context = this._contexts.get(workspacePath)

    if (!context || context.disposed) {
      // Create new context
      const contextOptions: WorkspaceContextOptions = {
        workspacePath,
        watch: this._defaultOptions.watch,
        env: this._defaultOptions.env,
        logRalphEvents: this._defaultOptions.logRalphEvents,
        ralphCommand: this._defaultOptions.ralphCommand,
        ralphArgs: this._defaultOptions.ralphArgs,
      }
      context = new WorkspaceContext(contextOptions)
      this._contexts.set(workspacePath, context)

      // Emit creation event
      this.emit("context:created", workspacePath, context)

      // Enforce max contexts limit
      this.enforceMaxContexts()
    }

    return context
  }

  /**
   * Get an existing context without creating one.
   * Returns undefined if no context exists for the given path.
   */
  get(
    /** The workspace path */
    workspacePath: string,
  ): WorkspaceContext | undefined {
    const context = this._contexts.get(workspacePath)
    return context?.disposed ? undefined : context
  }

  /**
   * Check if a context exists for the given workspace path.
   */
  has(
    /** The workspace path */
    workspacePath: string,
  ): boolean {
    const context = this._contexts.get(workspacePath)
    return context !== undefined && !context.disposed
  }

  /**
   * Get all workspace paths with active contexts.
   */
  getWorkspacePaths(): string[] {
    return Array.from(this._contexts.entries())
      .filter(([, context]) => !context.disposed)
      .map(([path]) => path)
  }

  /**
   * Get the number of active contexts.
   */
  get size(): number {
    return Array.from(this._contexts.values()).filter(c => !c.disposed).length
  }

  /**
   * Get the currently active context.
   * Returns undefined if no context is active.
   */
  getActiveContext(): WorkspaceContext | undefined {
    if (!this._activeWorkspacePath) {
      return undefined
    }
    const context = this._contexts.get(this._activeWorkspacePath)
    return context?.disposed ? undefined : context
  }

  /**
   * Get the currently active workspace path.
   */
  get activeWorkspacePath(): string | undefined {
    return this._activeWorkspacePath
  }

  /**
   * Set the active context by workspace path.
   * Creates the context if it doesn't exist.
   * Returns the activated context.
   */
  setActiveContext(
    /** The workspace path to make active */
    workspacePath: string,
  ): WorkspaceContext {
    // Unbind events from previous active context
    this.unbindActiveContextEvents()

    // Get or create the context
    const context = this.getOrCreate(workspacePath)
    this._activeWorkspacePath = workspacePath

    // Bind events from new active context
    this.bindActiveContextEvents(context, workspacePath)

    // Emit activation event
    this.emit("context:activated", workspacePath, context)

    return context
  }

  /**
   * Dispose of a specific context.
   * If disposing the active context, clears the active state.
   */
  async dispose(
    /** The workspace path to dispose */
    workspacePath: string,
  ): Promise<void> {
    const context = this._contexts.get(workspacePath)
    if (!context) {
      return
    }

    // If this is the active context, unbind events and clear active state
    if (workspacePath === this._activeWorkspacePath) {
      this.unbindActiveContextEvents()
      this._activeWorkspacePath = undefined
    }

    // Dispose the context
    await context.dispose()
    this._contexts.delete(workspacePath)

    // Emit disposal event
    this.emit("context:disposed", workspacePath)
  }

  /**
   * Dispose of all contexts and clear the manager.
   */
  async disposeAll(): Promise<void> {
    // Unbind events first
    this.unbindActiveContextEvents()
    this._activeWorkspacePath = undefined

    // Dispose all contexts
    const disposals = Array.from(this._contexts.entries()).map(async ([path, context]) => {
      await context.dispose()
      this.emit("context:disposed", path)
    })

    await Promise.all(disposals)
    this._contexts.clear()
  }

  /**
   * Bind event forwarding from the active context.
   */
  private bindActiveContextEvents(
    /** The context to bind events from */
    context: WorkspaceContext,
    /** The workspace path for this context */
    workspacePath: string,
  ): void {
    // Create a handler that forwards all events with workspace path prefix
    this._boundEventHandler = (eventType: string, ...args: unknown[]) => {
      this.emit("context:event", workspacePath, eventType, ...args)
    }

    // Forward all known event types from WorkspaceContext
    const eventTypes = [
      "ralph:event",
      "ralph:status",
      "ralph:output",
      "ralph:error",
      "ralph:exit",
      "task-chat:message",
      "task-chat:chunk",
      "task-chat:status",
      "task-chat:error",
      "task-chat:tool_use",
      "task-chat:tool_update",
      "task-chat:tool_result",
      "task-chat:event",
      "mutation:event",
    ]

    for (const eventType of eventTypes) {
      context.on(eventType, (...args: unknown[]) => {
        // Only forward if this is still the active context
        if (this._activeWorkspacePath === workspacePath && this._boundEventHandler) {
          this._boundEventHandler(eventType, ...args)
        }
      })
    }
  }

  /**
   * Unbind event forwarding from the current active context.
   */
  private unbindActiveContextEvents(): void {
    if (!this._activeWorkspacePath || !this._boundEventHandler) {
      return
    }

    const context = this._contexts.get(this._activeWorkspacePath)
    if (context && !context.disposed) {
      // We don't actually remove listeners from the context since it might have
      // other listeners. Instead, we just clear our handler reference so events
      // won't be forwarded. The context's listeners will be cleaned up when
      // the context is disposed.
    }

    this._boundEventHandler = null
  }

  /**
   * Enforce the maximum contexts limit by disposing the least recently used contexts.
   * The active context is never disposed.
   */
  private enforceMaxContexts(): void {
    if (this._maxContexts <= 0) {
      return // Unlimited
    }

    // Get all non-disposed contexts
    const activeContexts = Array.from(this._contexts.entries()).filter(([, c]) => !c.disposed)

    if (activeContexts.length <= this._maxContexts) {
      return
    }

    // Sort by some heuristic - for now, just dispose contexts that aren't active
    // In the future, we could track access times for LRU eviction
    const contextsToDispose = activeContexts
      .filter(([path]) => path !== this._activeWorkspacePath)
      .slice(0, activeContexts.length - this._maxContexts)

    for (const [path, context] of contextsToDispose) {
      // Dispose asynchronously but don't wait
      context.dispose().then(() => {
        this._contexts.delete(path)
        this.emit("context:disposed", path)
      })
    }
  }
}

/**  Options for creating a WorkspaceContextManager. */
export interface WorkspaceContextManagerOptions {
  /** Run RalphManager in watch mode for new contexts */
  watch?: boolean
  /** Additional environment variables for new contexts */
  env?: Record<string, string>
  /** Maximum number of contexts to keep (0 = unlimited). Default: 10 */
  maxContexts?: number
  /** Log ralph process events to console. Defaults to false. */
  logRalphEvents?: boolean
  /** Command to spawn Ralph CLI (default: "npx") */
  ralphCommand?: string
  /** Arguments for the Ralph CLI command (default: ["@herbcaudill/ralph", "--json"]) */
  ralphArgs?: string[]
}
