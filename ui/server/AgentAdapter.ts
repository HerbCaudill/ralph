/**
 * AgentAdapter - Core abstraction for multi-agent support
 *
 * This module defines the interface that all agent adapters must implement,
 * as well as the normalized event types they emit. This allows the UI to work
 * with different agent backends (Claude CLI, Codex CLI, etc.) without knowing
 * the specifics of each agent's native event format.
 */

import { EventEmitter } from "node:events"

// =============================================================================
// Normalized Agent Event Types
// =============================================================================

/**
 * Base properties for all agent events.
 */
interface AgentEventBase {
  /** Event timestamp in milliseconds */
  timestamp: number
  /** Optional event ID for correlation */
  id?: string
}

/**
 * A text message from the assistant.
 */
export interface AgentMessageEvent extends AgentEventBase {
  type: "message"
  /** The message content */
  content: string
  /** Whether this is a partial/streaming message */
  isPartial?: boolean
}

/**
 * A tool invocation by the assistant.
 */
export interface AgentToolUseEvent extends AgentEventBase {
  type: "tool_use"
  /** Unique ID for this tool use (for correlating with tool_result) */
  toolUseId: string
  /** Name of the tool being used */
  tool: string
  /** Tool input parameters */
  input: Record<string, unknown>
}

/**
 * The result of a tool invocation.
 */
export interface AgentToolResultEvent extends AgentEventBase {
  type: "tool_result"
  /** ID of the corresponding tool_use event */
  toolUseId: string
  /** Tool output (success case) */
  output?: string
  /** Error message (error case) */
  error?: string
  /** Whether this result is an error */
  isError: boolean
}

/**
 * Final result of an agent run.
 */
export interface AgentResultEvent extends AgentEventBase {
  type: "result"
  /** The final text output from the agent */
  content: string
  /** Exit code if applicable */
  exitCode?: number
  /** Usage statistics */
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

/**
 * An error from the agent.
 */
export interface AgentErrorEvent extends AgentEventBase {
  type: "error"
  /** Error message */
  message: string
  /** Error code if applicable */
  code?: string
  /** Whether this error is fatal (agent cannot continue) */
  fatal: boolean
}

/**
 * Agent status changed.
 */
export interface AgentStatusEvent extends AgentEventBase {
  type: "status"
  /** The new status */
  status: AgentStatus
}

/**
 * Union type for all normalized agent events.
 */
export type AgentEvent =
  | AgentMessageEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | AgentResultEvent
  | AgentErrorEvent
  | AgentStatusEvent

// =============================================================================
// Agent Status
// =============================================================================

/**
 * Possible agent statuses.
 */
export type AgentStatus = "idle" | "starting" | "running" | "paused" | "stopping" | "stopped"

// =============================================================================
// Agent Adapter Interface
// =============================================================================

/**
 * Configuration options for starting an agent.
 */
export interface AgentStartOptions {
  /** Working directory for the agent */
  cwd?: string
  /** Environment variables to pass to the agent */
  env?: Record<string, string>
  /** System prompt for the agent */
  systemPrompt?: string
  /** Model to use (agent-specific) */
  model?: string
  /** Maximum number of iterations/turns */
  maxIterations?: number
  /** Additional agent-specific options */
  [key: string]: unknown
}

/**
 * Interface for sending messages to an agent.
 */
export interface AgentMessage {
  /** The message type */
  type: "user_message" | "control"
  /** Message content for user_message type */
  content?: string
  /** Control command for control type (e.g., "pause", "resume", "stop") */
  command?: "pause" | "resume" | "stop"
}

/**
 * Information about an agent adapter's capabilities.
 */
export interface AgentInfo {
  /** Unique identifier for this agent type */
  id: string
  /** Human-readable name */
  name: string
  /** Description of the agent */
  description?: string
  /** Version of the agent/CLI */
  version?: string
  /** Supported features */
  features: {
    /** Supports streaming responses */
    streaming: boolean
    /** Supports tool use */
    tools: boolean
    /** Supports pause/resume */
    pauseResume: boolean
    /** Supports system prompts */
    systemPrompt: boolean
  }
}

/**
 * Events emitted by an AgentAdapter.
 */
export interface AgentAdapterEvents {
  /** A normalized agent event */
  event: (event: AgentEvent) => void
  /** Agent status changed */
  status: (status: AgentStatus) => void
  /** An error occurred */
  error: (error: Error) => void
  /** Agent process exited */
  exit: (info: { code?: number; signal?: string }) => void
}

/**
 * Abstract base class for agent adapters.
 *
 * Agent adapters translate between the native event format of a specific agent
 * (e.g., Claude CLI, Codex CLI) and the normalized AgentEvent format used by
 * the UI.
 *
 * Implementations must:
 * 1. Implement all abstract methods
 * 2. Emit normalized AgentEvent objects via the 'event' event
 * 3. Update and emit status changes via the 'status' event
 *
 * @example
 * ```ts
 * class ClaudeAdapter extends AgentAdapter {
 *   async start(options?: AgentStartOptions): Promise<void> {
 *     // Spawn claude CLI process
 *     // Parse native events and emit normalized AgentEvents
 *   }
 *   // ... implement other methods
 * }
 * ```
 */
export abstract class AgentAdapter extends EventEmitter {
  protected _status: AgentStatus = "idle"

  constructor() {
    super()
  }

  /**
   * Get the current status of the agent.
   */
  get status(): AgentStatus {
    return this._status
  }

  /**
   * Check if the agent is currently running.
   */
  get isRunning(): boolean {
    return this._status === "running"
  }

  /**
   * Get information about this agent adapter.
   */
  abstract getInfo(): AgentInfo

  /**
   * Check if this agent is available (e.g., CLI is installed).
   *
   * @returns Promise that resolves to true if available, false otherwise
   */
  abstract isAvailable(): Promise<boolean>

  /**
   * Start the agent.
   *
   * @param options - Configuration options for starting the agent
   * @returns Promise that resolves when the agent has started
   */
  abstract start(options?: AgentStartOptions): Promise<void>

  /**
   * Send a message to the agent.
   *
   * @param message - The message to send
   */
  abstract send(message: AgentMessage): void

  /**
   * Stop the agent.
   *
   * @param force - If true, force stop immediately; otherwise, allow graceful shutdown
   * @returns Promise that resolves when the agent has stopped
   */
  abstract stop(force?: boolean): Promise<void>

  /**
   * Set status and emit status event.
   */
  protected setStatus(status: AgentStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
      // Also emit a normalized status event
      const statusEvent: AgentStatusEvent = {
        type: "status",
        timestamp: Date.now(),
        status,
      }
      this.emit("event", statusEvent)
    }
  }

  /**
   * Helper to create a timestamp for events.
   */
  protected now(): number {
    return Date.now()
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if an event is a message event.
 */
export function isAgentMessageEvent(event: AgentEvent): event is AgentMessageEvent {
  return event.type === "message"
}

/**
 * Check if an event is a tool use event.
 */
export function isAgentToolUseEvent(event: AgentEvent): event is AgentToolUseEvent {
  return event.type === "tool_use"
}

/**
 * Check if an event is a tool result event.
 */
export function isAgentToolResultEvent(event: AgentEvent): event is AgentToolResultEvent {
  return event.type === "tool_result"
}

/**
 * Check if an event is a result event.
 */
export function isAgentResultEvent(event: AgentEvent): event is AgentResultEvent {
  return event.type === "result"
}

/**
 * Check if an event is an error event.
 */
export function isAgentErrorEvent(event: AgentEvent): event is AgentErrorEvent {
  return event.type === "error"
}

/**
 * Check if an event is a status event.
 */
export function isAgentStatusEvent(event: AgentEvent): event is AgentStatusEvent {
  return event.type === "status"
}
