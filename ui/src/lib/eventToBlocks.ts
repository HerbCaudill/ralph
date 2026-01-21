/**
 * eventToBlocks - Converts normalized AgentEvents to display blocks
 *
 * This module processes the normalized AgentEvent format (from AgentAdapter)
 * and converts them into display-friendly blocks for the UI. Since events are
 * pre-normalized by the adapter, this is simpler than the previous approach
 * of parsing raw SDK events.
 */

import type {
  AgentEvent,
  AgentMessageEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
} from "../../server/AgentAdapter.js"
import type { AssistantTextEvent, ToolUseEvent, ToolName } from "@/types"

// Display Block Types

/**
 * A text message from the assistant (rendered as markdown)
 */
export interface TextBlock {
  type: "text"
  timestamp: number
  content: string
}

/**
 * A tool use with optional result
 */
export interface ToolUseBlock {
  type: "tool_use"
  timestamp: number
  toolUseId: string
  tool: string
  input: Record<string, unknown>
  output?: string
  error?: string
  status: "pending" | "running" | "success" | "error"
}

/**
 * An error message
 */
export interface ErrorBlock {
  type: "error"
  timestamp: number
  message: string
  code?: string
  fatal: boolean
}

/**
 * A status change event (for debugging/visualization)
 */
export interface StatusBlock {
  type: "status"
  timestamp: number
  status: string
}

/**
 * Union of all display block types
 */
export type DisplayBlock = TextBlock | ToolUseBlock | ErrorBlock | StatusBlock

// Conversion State

interface ConversionState {
  /** Map of tool use ID to pending tool use info */
  pendingToolUses: Map<string, { tool: string; input: Record<string, unknown>; timestamp: number }>
  /** Accumulated message content for streaming */
  currentMessageContent: string
  /** Whether we're in a streaming message */
  isStreaming: boolean
}

function createInitialState(): ConversionState {
  return {
    pendingToolUses: new Map(),
    currentMessageContent: "",
    isStreaming: false,
  }
}

// Event Type Guards

export function isAgentMessageEvent(event: AgentEvent): event is AgentMessageEvent {
  return event.type === "message"
}

export function isAgentToolUseEvent(event: AgentEvent): event is AgentToolUseEvent {
  return event.type === "tool_use"
}

export function isAgentToolResultEvent(event: AgentEvent): event is AgentToolResultEvent {
  return event.type === "tool_result"
}

export function isAgentResultEvent(event: AgentEvent): event is AgentResultEvent {
  return event.type === "result"
}

export function isAgentErrorEvent(event: AgentEvent): event is AgentErrorEvent {
  return event.type === "error"
}

export function isAgentStatusEvent(event: AgentEvent): event is AgentStatusEvent {
  return event.type === "status"
}

// Main Conversion Function

/**
 * Convert a stream of AgentEvents to display blocks.
 *
 * This function processes normalized events and produces display-ready blocks.
 * It handles:
 * - Streaming text messages (accumulating partial content)
 * - Tool uses and their results (matching by toolUseId)
 * - Error events
 * - Status changes (optional, for debugging)
 *
 * @param events - Array of normalized AgentEvents
 * @param options - Conversion options
 * @returns Array of display blocks
 */
export function eventToBlocks(
  events: AgentEvent[],
  options: { includeStatusEvents?: boolean } = {},
): DisplayBlock[] {
  const { includeStatusEvents = false } = options
  const state = createInitialState()
  const blocks: DisplayBlock[] = []

  for (const event of events) {
    const newBlocks = processEvent(event, state, { includeStatusEvents })
    blocks.push(...newBlocks)
  }

  // If there's accumulated streaming content, emit it as a final text block
  if (state.currentMessageContent.trim()) {
    blocks.push({
      type: "text",
      timestamp: Date.now(),
      content: state.currentMessageContent,
    })
  }

  return blocks
}

/**
 * Process a single event and return any blocks it produces
 */
function processEvent(
  event: AgentEvent,
  state: ConversionState,
  options: { includeStatusEvents: boolean },
): DisplayBlock[] {
  const blocks: DisplayBlock[] = []

  if (isAgentMessageEvent(event)) {
    if (event.isPartial) {
      // Streaming: accumulate content
      state.currentMessageContent += event.content
      state.isStreaming = true
    } else {
      // Complete message: emit any accumulated content first, then this one
      if (state.currentMessageContent.trim() && state.currentMessageContent !== event.content) {
        // Only emit accumulated content if it's different from this message
        // (sometimes a complete message follows streaming with the full content)
      }
      state.currentMessageContent = ""
      state.isStreaming = false

      if (event.content.trim()) {
        blocks.push({
          type: "text",
          timestamp: event.timestamp,
          content: event.content,
        })
      }
    }
  } else if (isAgentToolUseEvent(event)) {
    // Flush any accumulated message content
    if (state.currentMessageContent.trim()) {
      blocks.push({
        type: "text",
        timestamp: event.timestamp - 1, // Slightly before tool use
        content: state.currentMessageContent,
      })
      state.currentMessageContent = ""
    }

    // Track pending tool use
    state.pendingToolUses.set(event.toolUseId, {
      tool: event.tool,
      input: event.input,
      timestamp: event.timestamp,
    })

    // Emit tool use block (initially running)
    blocks.push({
      type: "tool_use",
      timestamp: event.timestamp,
      toolUseId: event.toolUseId,
      tool: event.tool,
      input: event.input,
      status: "running",
    })
  } else if (isAgentToolResultEvent(event)) {
    // Find the corresponding tool use and update it
    // Note: In streaming scenarios, we might need to emit an updated block
    // For now, we'll emit a new block with the result (UI can dedupe by toolUseId)
    const toolUse = state.pendingToolUses.get(event.toolUseId)
    if (toolUse) {
      blocks.push({
        type: "tool_use",
        timestamp: event.timestamp,
        toolUseId: event.toolUseId,
        tool: toolUse.tool,
        input: toolUse.input,
        output: event.output,
        error: event.error,
        status: event.isError ? "error" : "success",
      })
      state.pendingToolUses.delete(event.toolUseId)
    }
  } else if (isAgentResultEvent(event)) {
    // Final result - could emit as a text block if it has content
    // Often the content is the same as accumulated messages, so we skip
  } else if (isAgentErrorEvent(event)) {
    blocks.push({
      type: "error",
      timestamp: event.timestamp,
      message: event.message,
      code: event.code,
      fatal: event.fatal,
    })
  } else if (isAgentStatusEvent(event)) {
    if (options.includeStatusEvents) {
      blocks.push({
        type: "status",
        timestamp: event.timestamp,
        status: event.status,
      })
    }
  }

  return blocks
}

// Conversion to Legacy Event Types

/**
 * Convert a TextBlock to AssistantTextEvent for existing component compatibility
 */
export function toAssistantTextEvent(block: TextBlock): AssistantTextEvent {
  return {
    type: "text",
    timestamp: block.timestamp,
    content: block.content,
  }
}

/**
 * Convert a ToolUseBlock to ToolUseEvent for existing component compatibility
 */
export function toToolUseEvent(block: ToolUseBlock): ToolUseEvent {
  return {
    type: "tool_use",
    timestamp: block.timestamp,
    tool: block.tool as ToolName,
    input: block.input,
    output: block.output,
    error: block.error,
    status: block.status,
  }
}

// Streaming State Helper

/**
 * State for incremental event processing (useful for real-time updates)
 */
export class EventBlockConverter {
  private state: ConversionState
  private options: { includeStatusEvents: boolean }

  constructor(options: { includeStatusEvents?: boolean } = {}) {
    this.state = createInitialState()
    this.options = { includeStatusEvents: options.includeStatusEvents ?? false }
  }

  /**
   * Process a single event and return any new blocks
   */
  processEvent(event: AgentEvent): DisplayBlock[] {
    return processEvent(event, this.state, this.options)
  }

  /**
   * Get any pending streaming content as a text block
   */
  getStreamingBlock(): TextBlock | null {
    if (this.state.currentMessageContent.trim()) {
      return {
        type: "text",
        timestamp: Date.now(),
        content: this.state.currentMessageContent,
      }
    }
    return null
  }

  /**
   * Get all pending tool uses that haven't received results yet
   */
  getPendingToolUses(): ToolUseBlock[] {
    const blocks: ToolUseBlock[] = []
    for (const [toolUseId, info] of this.state.pendingToolUses) {
      blocks.push({
        type: "tool_use",
        timestamp: info.timestamp,
        toolUseId,
        tool: info.tool,
        input: info.input,
        status: "running",
      })
    }
    return blocks
  }

  /**
   * Reset the converter state
   */
  reset(): void {
    this.state = createInitialState()
  }
}

// Merging Helper for Tool Results

/**
 * Merge tool results into existing blocks (for UI that keeps blocks in state)
 *
 * When a tool_result event comes in, find the matching tool_use block and update it
 */
export function mergeToolResult(
  blocks: DisplayBlock[],
  result: AgentToolResultEvent,
): DisplayBlock[] {
  return blocks.map(block => {
    if (block.type === "tool_use" && block.toolUseId === result.toolUseId) {
      return {
        ...block,
        output: result.output,
        error: result.error,
        status: result.isError ? ("error" as const) : ("success" as const),
      }
    }
    return block
  })
}
