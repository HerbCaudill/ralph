/**
 * Type definitions for agent-related interfaces.
 *
 * These types are extracted here so that agent-server modules can reference them
 * without depending directly on ClaudeAdapter or AgentAdapter.
 */

import { EventEmitter } from "node:events"
import type {
  MessageEventType,
  ThinkingEventType,
  ToolUseEventType,
  ToolResultEventType,
  ResultEventType,
  ErrorEventType,
  StatusEventType,
  BaseEventType,
  AgentStatus as CanonicalAgentStatus,
} from "@herbcaudill/agent-view"

// ── Backward-compatible event types ──────────────────────────────────

/**
 * Makes `id` optional and removes `readonly` modifiers for backward compatibility.
 *
 * The canonical types from agent-view require `id` (auto-generated via Effect
 * Schema defaults during decoding) and use `readonly` properties. Existing code
 * creates events without `id` and expects mutable properties, so the
 * backward-compatible aliases relax these constraints.
 */
type BackwardCompat<T> = { -readonly [K in keyof T as K extends "id" ? never : K]: T[K] } & {
  id?: string
}

/** Base properties for all agent events. */
export type AgentEventBase = BackwardCompat<BaseEventType>

/** A text message from the assistant. */
export type AgentMessageEvent = BackwardCompat<MessageEventType>

/** A thinking block from the assistant (extended thinking). */
export type AgentThinkingEvent = BackwardCompat<ThinkingEventType>

/** A tool invocation by the assistant. */
export type AgentToolUseEvent = BackwardCompat<ToolUseEventType>

/** The result of a tool invocation. */
export type AgentToolResultEvent = BackwardCompat<ToolResultEventType>

/** Final result of an agent run. */
export type AgentResultEvent = BackwardCompat<ResultEventType>

/** An error from the agent. */
export type AgentErrorEvent = BackwardCompat<ErrorEventType>

/** Agent status changed. */
export type AgentStatusEvent = BackwardCompat<StatusEventType>

/** Union type for all normalized agent events. */
export type AgentEvent =
  | AgentMessageEvent
  | AgentThinkingEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | AgentResultEvent
  | AgentErrorEvent
  | AgentStatusEvent

/** Possible agent statuses. */
export type AgentStatus = CanonicalAgentStatus

// ── Type guards ──────────────────────────────────────────────────────

/** Check if an event is a message event. */
export function isAgentMessageEvent(event: AgentEvent): event is AgentMessageEvent {
  return event.type === "message"
}

/** Check if an event is a thinking event. */
export function isAgentThinkingEvent(event: AgentEvent): event is AgentThinkingEvent {
  return event.type === "thinking"
}

/** Check if an event is a tool use event. */
export function isAgentToolUseEvent(event: AgentEvent): event is AgentToolUseEvent {
  return event.type === "tool_use"
}

/** Check if an event is a tool result event. */
export function isAgentToolResultEvent(event: AgentEvent): event is AgentToolResultEvent {
  return event.type === "tool_result"
}

/** Check if an event is a result event. */
export function isAgentResultEvent(event: AgentEvent): event is AgentResultEvent {
  return event.type === "result"
}

/** Check if an event is an error event. */
export function isAgentErrorEvent(event: AgentEvent): event is AgentErrorEvent {
  return event.type === "error"
}

/** Check if an event is a status event. */
export function isAgentStatusEvent(event: AgentEvent): event is AgentStatusEvent {
  return event.type === "status"
}

// ── Conversation types (from ClaudeAdapter) ──────────────────────────

/**
 * A message in the conversation history.
 * Represents either a user prompt or assistant content (including tool use/results).
 */
export interface ConversationMessage {
  /** Role of the message sender */
  role: "user" | "assistant"
  /** The message content (user prompt or assistant text) */
  content: string
  /** Timestamp when this message was recorded */
  timestamp: number
  /** Tool uses in this assistant message (if any) */
  toolUses?: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    result?: {
      output?: string
      error?: string
      isError: boolean
    }
  }>
}

/**
 * Serializable conversation context that can be saved and restored
 * to preserve session state across reconnections.
 */
export interface ConversationContext {
  /** The conversation history */
  messages: ConversationMessage[]
  /** The last user prompt sent */
  lastPrompt?: string
  /** Total usage statistics across the conversation */
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  /** Timestamp when this context was created/last updated */
  timestamp: number
}

// ── Agent adapter types (from AgentAdapter) ──────────────────────────

/**  Configuration options for starting an agent. */
export interface AgentStartOptions {
  /** Working directory for the agent */
  cwd?: string
  /** Environment variables to pass to the agent */
  env?: Record<string, string>
  /** System prompt for the agent */
  systemPrompt?: string
  /** Model to use (agent-specific) */
  model?: string
  /** Maximum number of sessions/turns */
  maxSessions?: number
  /** Additional agent-specific options */
  [key: string]: unknown
}

/**  Interface for sending messages to an agent. */
export interface AgentMessage {
  /** The message type */
  type: "user_message" | "control"
  /** Message content for user_message type */
  content?: string
  /** Control command for control type (e.g., "pause", "resume", "stop", "interrupt") */
  command?: "pause" | "resume" | "stop" | "interrupt"
}

/**  Information about an agent adapter's capabilities. */
export interface AgentInfo {
  /** Unique identifier for this agent type */
  id: string
  /** Human-readable name */
  name: string
  /** Description of the agent */
  description?: string
  /** Version of the agent/CLI */
  version?: string
  /** Default model being used (if configured) */
  model?: string
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

/**  Events emitted by an AgentAdapter. */
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
 */
export abstract class AgentAdapter extends EventEmitter {
  protected _status: AgentStatus = "idle"

  constructor() {
    super()
  }

  /** Get the current status of the agent. */
  get status(): AgentStatus {
    return this._status
  }

  /** Check if the agent is currently running. */
  get isRunning(): boolean {
    return this._status === "running"
  }

  /** Get information about this agent adapter. */
  abstract getInfo(): AgentInfo

  /** Check if this agent is available (e.g., CLI is installed). */
  abstract isAvailable(): Promise<boolean>

  /** Start the agent. */
  abstract start(options?: AgentStartOptions): Promise<void>

  /** Send a message to the agent. */
  abstract send(message: AgentMessage): void

  /** Stop the agent. */
  abstract stop(force?: boolean): Promise<void>

  /** Set status and emit status event. */
  protected setStatus(status: AgentStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
      const statusEvent: AgentStatusEvent = {
        type: "status",
        timestamp: Date.now(),
        status,
      }
      this.emit("event", statusEvent)
    }
  }

  /** Helper to create a timestamp for events. */
  protected now(): number {
    return Date.now()
  }
}
