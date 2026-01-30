import type {
  AssistantChatEvent,
  ChatEvent,
  ErrorChatEvent,
  ResultChatEvent,
  ToolUseChatEvent,
} from "@herbcaudill/agent-view"
import type {
  AgentMessageItem,
  CommandExecutionItem,
  ErrorItem,
  FileChangeItem,
  McpToolCallItem,
  ReasoningItem,
  ThreadItem,
  Usage,
} from "@openai/codex-sdk"

/**
 * Convert a single native Codex SDK event into zero or more ChatEvents.
 *
 * Codex thread events are structured differently from Claude CLI events,
 * so this adapter performs a non-trivial translation. A single Codex event
 * may produce zero ChatEvents (e.g., `thread.started`) or one ChatEvent.
 */
export const convertCodexEvent = (
  /** The native event from the Codex SDK (`ThreadEvent`). */
  nativeEvent: unknown,
): ChatEvent[] => {
  if (nativeEvent == null || typeof nativeEvent !== "object") {
    return []
  }

  const event = nativeEvent as Record<string, unknown>
  const type = event.type

  if (typeof type !== "string") {
    return []
  }

  switch (type) {
    case "item.started":
      return convertItemStarted(event.item as ThreadItem | undefined)

    case "item.completed":
      return convertItemCompleted(event.item as ThreadItem | undefined)

    case "item.updated":
      return convertItemUpdated(event.item as ThreadItem | undefined)

    case "turn.completed":
      return convertTurnCompleted(event as Record<string, unknown>)

    case "turn.failed":
      return convertTurnFailed(event as Record<string, unknown>)

    case "error":
      return convertError(event)

    case "thread.started":
    case "turn.started":
      // These events don't produce ChatEvents
      return []

    default:
      return []
  }
}

/**
 * Convert an `item.started` event. Emits a pending tool_use for command executions
 * and mcp tool calls.
 */
const convertItemStarted = (
  /** The thread item that started. */
  item: ThreadItem | undefined,
): ChatEvent[] => {
  if (!item) return []

  switch (item.type) {
    case "command_execution": {
      const cmd = item as CommandExecutionItem
      const event: ToolUseChatEvent = {
        type: "tool_use",
        id: cmd.id,
        tool: "Bash",
        input: { command: cmd.command },
        status: "running",
      }
      return [event]
    }

    case "mcp_tool_call": {
      const mcp = item as McpToolCallItem
      const event: ToolUseChatEvent = {
        type: "tool_use",
        id: mcp.id,
        tool: "Task",
        input: {
          server: mcp.server,
          tool: mcp.tool,
          arguments: mcp.arguments,
        },
        status: "running",
      }
      return [event]
    }

    default:
      return []
  }
}

/**
 * Convert an `item.completed` event. Produces assistant text, tool results,
 * or error events depending on the item type.
 */
const convertItemCompleted = (
  /** The thread item that completed. */
  item: ThreadItem | undefined,
): ChatEvent[] => {
  if (!item) return []

  switch (item.type) {
    case "agent_message": {
      const msg = item as AgentMessageItem
      if (!msg.text) return []
      const event: AssistantChatEvent = {
        type: "assistant",
        message: {
          content: [{ type: "text", text: msg.text }],
        },
      }
      return [event]
    }

    case "reasoning": {
      const reasoning = item as ReasoningItem
      if (!reasoning.text) return []
      const event: AssistantChatEvent = {
        type: "assistant",
        message: {
          content: [{ type: "thinking", thinking: reasoning.text }],
        },
      }
      return [event]
    }

    case "command_execution": {
      const cmd = item as CommandExecutionItem
      const isError = cmd.exit_code !== undefined && cmd.exit_code !== 0
      const output = cmd.aggregated_output ?? ""
      const event: ToolUseChatEvent = {
        type: "tool_use",
        id: cmd.id,
        tool: "Bash",
        input: { command: cmd.command },
        output: output,
        status: isError ? "error" : "success",
        error: isError ? output || `Command failed with exit code ${cmd.exit_code}` : undefined,
      }
      return [event]
    }

    case "file_change": {
      const fc = item as FileChangeItem
      const summary = fc.changes.map(c => `${c.kind}: ${c.path}`).join("\n")
      const event: ToolUseChatEvent = {
        type: "tool_use",
        id: fc.id,
        tool: "Edit",
        input: { changes: fc.changes },
        output: summary,
        status: fc.status === "completed" ? "success" : "error",
        error: fc.status === "failed" ? "Patch application failed" : undefined,
      }
      return [event]
    }

    case "mcp_tool_call": {
      const mcp = item as McpToolCallItem
      const isError = mcp.status === "failed"
      const event: ToolUseChatEvent = {
        type: "tool_use",
        id: mcp.id,
        tool: "Task",
        input: {
          server: mcp.server,
          tool: mcp.tool,
          arguments: mcp.arguments,
        },
        output: mcp.result ? JSON.stringify(mcp.result) : undefined,
        status: isError ? "error" : "success",
        error: isError ? (mcp.error?.message ?? "MCP tool call failed") : undefined,
      }
      return [event]
    }

    case "error": {
      const err = item as ErrorItem
      const event: ErrorChatEvent = {
        type: "error",
        error: err.message,
      }
      return [event]
    }

    default:
      return []
  }
}

/**
 * Convert an `item.updated` event. Currently only produces events for
 * command execution streaming output.
 */
const convertItemUpdated = (
  /** The thread item that was updated. */
  item: ThreadItem | undefined,
): ChatEvent[] => {
  if (!item) return []

  if (item.type === "command_execution") {
    const cmd = item as CommandExecutionItem
    const event: ToolUseChatEvent = {
      type: "tool_use",
      id: cmd.id,
      tool: "Bash",
      input: { command: cmd.command },
      output: cmd.aggregated_output ?? "",
      status: "running",
    }
    return [event]
  }

  return []
}

/**
 * Convert a `turn.completed` event into a ResultChatEvent with token usage.
 */
const convertTurnCompleted = (
  /** The raw turn.completed event object. */
  event: Record<string, unknown>,
): ChatEvent[] => {
  const usage = event.usage as Usage | undefined
  const result: ResultChatEvent = {
    type: "result",
    usage:
      usage ?
        {
          inputTokens: (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0),
          outputTokens: usage.output_tokens ?? 0,
          input_tokens: (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0),
          output_tokens: usage.output_tokens ?? 0,
        }
      : undefined,
  }
  return [result]
}

/**
 * Convert a `turn.failed` event into an ErrorChatEvent.
 */
const convertTurnFailed = (
  /** The raw turn.failed event object. */
  event: Record<string, unknown>,
): ChatEvent[] => {
  const error = event.error as { message?: string } | undefined
  const errorEvent: ErrorChatEvent = {
    type: "error",
    error: error?.message ?? "Codex turn failed",
  }
  return [errorEvent]
}

/**
 * Convert a top-level `error` event into an ErrorChatEvent.
 */
const convertError = (
  /** The raw error event object. */
  event: Record<string, unknown>,
): ChatEvent[] => {
  const message = typeof event.message === "string" ? event.message : "Unknown error"
  const errorEvent: ErrorChatEvent = {
    type: "error",
    error: message,
  }
  return [errorEvent]
}
