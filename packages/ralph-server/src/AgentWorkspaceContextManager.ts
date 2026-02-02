import { EventEmitter } from "node:events"
import {
  AgentWorkspaceContext,
  type AgentWorkspaceContextOptions,
} from "./AgentWorkspaceContext.js"

/**
 * Manages multiple AgentWorkspaceContext instances.
 *
 * This is the agent-server's half of the WorkspaceContextManager,
 * handling agent-related workspace contexts. The beads-specific
 * context management stays in the UI/beads-server.
 *
 * Events:
 * - "context:created" - New context was created (workspacePath, context)
 * - "context:activated" - Context became active (workspacePath, context)
 * - "context:disposed" - Context was disposed (workspacePath)
 * - "context:event" - Event from any context (workspacePath, eventType, ...args)
 */
export class AgentWorkspaceContextManager extends EventEmitter {
  /** Map of workspace paths to their contexts */
  private _contexts = new Map<string, AgentWorkspaceContext>()

  /** The currently active workspace path */
  private _activeWorkspacePath: string | undefined

  /** Default options for creating new contexts */
  private _defaultOptions: AgentWorkspaceContextManagerOptions

  /** Maximum number of contexts to keep (0 = unlimited) */
  private _maxContexts: number

  /** Event handler bound to current active context (for cleanup) */
  private _boundEventHandler: ((eventType: string, ...args: unknown[]) => void) | null = null

  constructor(options: AgentWorkspaceContextManagerOptions = {}) {
    super()
    this._defaultOptions = options
    this._maxContexts = options.maxContexts ?? 10
  }

  /**
   * Get a context for the given workspace path, creating it if it doesn't exist.
   * Does NOT change the active context - use setActiveContext() for that.
   */
  getOrCreate(workspacePath: string): AgentWorkspaceContext {
    let context = this._contexts.get(workspacePath)

    if (!context || context.disposed) {
      const contextOptions: AgentWorkspaceContextOptions = {
        workspacePath,
        watch: this._defaultOptions.watch,
        env: this._defaultOptions.env,
        logRalphEvents: this._defaultOptions.logRalphEvents,
        ralphCommand: this._defaultOptions.ralphCommand,
        ralphArgs: this._defaultOptions.ralphArgs,
        getBdProxy: this._defaultOptions.getBdProxy,
      }
      context = new AgentWorkspaceContext(contextOptions)
      this._contexts.set(workspacePath, context)

      this.emit("context:created", workspacePath, context)
      this.enforceMaxContexts()
    }

    return context
  }

  /**
   * Get an existing context without creating one.
   */
  get(workspacePath: string): AgentWorkspaceContext | undefined {
    const context = this._contexts.get(workspacePath)
    return context?.disposed ? undefined : context
  }

  /**
   * Check if a context exists for the given workspace path.
   */
  has(workspacePath: string): boolean {
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
   */
  getActiveContext(): AgentWorkspaceContext | undefined {
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
   */
  setActiveContext(workspacePath: string): AgentWorkspaceContext {
    this.unbindActiveContextEvents()

    const context = this.getOrCreate(workspacePath)
    this._activeWorkspacePath = workspacePath

    this.bindActiveContextEvents(context, workspacePath)
    this.emit("context:activated", workspacePath, context)

    return context
  }

  /**
   * Dispose of a specific context.
   */
  async dispose(workspacePath: string): Promise<void> {
    const context = this._contexts.get(workspacePath)
    if (!context) {
      return
    }

    if (workspacePath === this._activeWorkspacePath) {
      this.unbindActiveContextEvents()
      this._activeWorkspacePath = undefined
    }

    await context.dispose()
    this._contexts.delete(workspacePath)
    this.emit("context:disposed", workspacePath)
  }

  /**
   * Dispose of all contexts and clear the manager.
   */
  async disposeAll(): Promise<void> {
    this.unbindActiveContextEvents()
    this._activeWorkspacePath = undefined

    const disposals = Array.from(this._contexts.entries()).map(async ([path, context]) => {
      await context.dispose()
      this.emit("context:disposed", path)
    })

    await Promise.all(disposals)
    this._contexts.clear()
  }

  private bindActiveContextEvents(context: AgentWorkspaceContext, workspacePath: string): void {
    this._boundEventHandler = (eventType: string, ...args: unknown[]) => {
      this.emit("context:event", workspacePath, eventType, ...args)
    }

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
      "task-chat:cleared",
    ]

    for (const eventType of eventTypes) {
      context.on(eventType, (...args: unknown[]) => {
        if (this._activeWorkspacePath === workspacePath && this._boundEventHandler) {
          this._boundEventHandler(eventType, ...args)
        }
      })
    }
  }

  private unbindActiveContextEvents(): void {
    if (!this._activeWorkspacePath || !this._boundEventHandler) {
      return
    }
    this._boundEventHandler = null
  }

  private enforceMaxContexts(): void {
    if (this._maxContexts <= 0) {
      return
    }

    const activeContexts = Array.from(this._contexts.entries()).filter(([, c]) => !c.disposed)

    if (activeContexts.length <= this._maxContexts) {
      return
    }

    const contextsToDispose = activeContexts
      .filter(([path]) => path !== this._activeWorkspacePath)
      .slice(0, activeContexts.length - this._maxContexts)

    for (const [path, context] of contextsToDispose) {
      context.dispose().then(() => {
        this._contexts.delete(path)
        this.emit("context:disposed", path)
      })
    }
  }
}

/**  Options for creating an AgentWorkspaceContextManager. */
export interface AgentWorkspaceContextManagerOptions {
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
  /** Arguments for the Ralph CLI command */
  ralphArgs?: string[]
  /** Function to get the BdProxy (for task chat context) */
  getBdProxy?: () => import("./agentTypes.js").BdProxy
}
