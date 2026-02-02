import { describe, it, expect } from "vitest"
import { convertCodexEvent } from ".././convertCodexEvent"
import { createCodexAdapter } from ".././createCodexAdapter"

describe("convertCodexEvent", () => {
  it("returns empty array for null input", () => {
    expect(convertCodexEvent(null)).toEqual([])
  })

  it("returns empty array for non-object input", () => {
    expect(convertCodexEvent("hello")).toEqual([])
    expect(convertCodexEvent(42)).toEqual([])
  })

  it("returns empty array for unrecognized event type", () => {
    expect(convertCodexEvent({ type: "unknown_type" })).toEqual([])
  })

  it("returns empty array for missing type", () => {
    expect(convertCodexEvent({ message: "no type" })).toEqual([])
  })

  it("returns empty array for thread.started", () => {
    expect(convertCodexEvent({ type: "thread.started" })).toEqual([])
  })

  it("returns empty array for turn.started", () => {
    expect(convertCodexEvent({ type: "turn.started" })).toEqual([])
  })

  describe("item.started events", () => {
    it("converts command_execution to pending tool_use", () => {
      const event = {
        type: "item.started",
        item: {
          type: "command_execution",
          id: "cmd-123",
          command: "ls -la",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).tool).toBe("Bash")
      expect((result[0] as any).id).toBe("cmd-123")
      expect((result[0] as any).input).toEqual({ command: "ls -la" })
      expect((result[0] as any).status).toBe("running")
      expect(result[0].timestamp).toBeUndefined()
    })

    it("converts mcp_tool_call to pending tool_use", () => {
      const event = {
        type: "item.started",
        item: {
          type: "mcp_tool_call",
          id: "mcp-456",
          server: "test-server",
          tool: "test-tool",
          arguments: { key: "value" },
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).tool).toBe("Task")
      expect((result[0] as any).id).toBe("mcp-456")
      expect((result[0] as any).input).toEqual({
        server: "test-server",
        tool: "test-tool",
        arguments: { key: "value" },
      })
      expect((result[0] as any).status).toBe("running")
    })

    it("returns empty array for item.started with no item", () => {
      expect(convertCodexEvent({ type: "item.started" })).toEqual([])
    })

    it("returns empty array for item.started with unsupported item type", () => {
      const event = {
        type: "item.started",
        item: { type: "agent_message", id: "msg-1" },
      }
      expect(convertCodexEvent(event)).toEqual([])
    })
  })

  describe("item.completed events", () => {
    it("converts agent_message to assistant event", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "agent_message",
          id: "msg-1",
          text: "Hello world",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("assistant")
      expect((result[0] as any).message.content).toEqual([{ type: "text", text: "Hello world" }])
      expect(result[0].timestamp).toBeUndefined()
    })

    it("returns empty array for agent_message with no text", () => {
      const event = {
        type: "item.completed",
        item: { type: "agent_message", id: "msg-1" },
      }
      expect(convertCodexEvent(event)).toEqual([])
    })

    it("converts reasoning to thinking content block", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "reasoning",
          id: "reasoning-1",
          text: "Let me think about this...",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("assistant")
      expect((result[0] as any).message.content).toEqual([
        { type: "thinking", thinking: "Let me think about this..." },
      ])
    })

    it("returns empty array for reasoning with no text", () => {
      const event = {
        type: "item.completed",
        item: { type: "reasoning", id: "reasoning-1" },
      }
      expect(convertCodexEvent(event)).toEqual([])
    })

    it("converts successful command_execution to tool_use with success status", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-123",
          command: "echo hello",
          aggregated_output: "hello\n",
          exit_code: 0,
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).tool).toBe("Bash")
      expect((result[0] as any).input).toEqual({ command: "echo hello" })
      expect((result[0] as any).output).toBe("hello\n")
      expect((result[0] as any).status).toBe("success")
      expect((result[0] as any).error).toBeUndefined()
    })

    it("converts failed command_execution to tool_use with error status", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-456",
          command: "false",
          aggregated_output: "error output",
          exit_code: 1,
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).status).toBe("error")
      expect((result[0] as any).error).toBe("error output")
      expect((result[0] as any).output).toBe("error output")
    })

    it("handles command_execution with no output", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-789",
          command: "true",
          exit_code: 0,
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect((result[0] as any).output).toBe("")
    })

    it("uses descriptive error for failed command with no output", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-error",
          command: "false",
          exit_code: 42,
        },
      }
      const result = convertCodexEvent(event)
      expect((result[0] as any).error).toBe("Command failed with exit code 42")
    })

    it("converts successful file_change to tool_use", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "file_change",
          id: "file-1",
          changes: [
            { kind: "edit", path: "/foo/bar.ts" },
            { kind: "create", path: "/foo/baz.ts" },
          ],
          status: "completed",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).tool).toBe("Edit")
      expect((result[0] as any).input).toEqual({
        changes: [
          { kind: "edit", path: "/foo/bar.ts" },
          { kind: "create", path: "/foo/baz.ts" },
        ],
      })
      expect((result[0] as any).output).toBe("edit: /foo/bar.ts\ncreate: /foo/baz.ts")
      expect((result[0] as any).status).toBe("success")
      expect((result[0] as any).error).toBeUndefined()
    })

    it("converts failed file_change to tool_use with error", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "file_change",
          id: "file-2",
          changes: [{ kind: "edit", path: "/invalid.ts" }],
          status: "failed",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect((result[0] as any).status).toBe("error")
      expect((result[0] as any).error).toBe("Patch application failed")
    })

    it("converts successful mcp_tool_call to tool_use", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          id: "mcp-1",
          server: "test-server",
          tool: "test-tool",
          arguments: { key: "value" },
          status: "completed",
          result: { success: true },
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).tool).toBe("Task")
      expect((result[0] as any).input).toEqual({
        server: "test-server",
        tool: "test-tool",
        arguments: { key: "value" },
      })
      expect((result[0] as any).output).toBe('{"success":true}')
      expect((result[0] as any).status).toBe("success")
      expect((result[0] as any).error).toBeUndefined()
    })

    it("converts failed mcp_tool_call to tool_use with error", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          id: "mcp-2",
          server: "test-server",
          tool: "test-tool",
          arguments: {},
          status: "failed",
          error: { message: "Tool execution failed" },
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect((result[0] as any).status).toBe("error")
      expect((result[0] as any).error).toBe("Tool execution failed")
    })

    it("uses default error message for failed mcp_tool_call with no error", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          id: "mcp-3",
          server: "test-server",
          tool: "test-tool",
          arguments: {},
          status: "failed",
        },
      }
      const result = convertCodexEvent(event)
      expect((result[0] as any).error).toBe("MCP tool call failed")
    })

    it("converts error item to error event", () => {
      const event = {
        type: "item.completed",
        item: {
          type: "error",
          id: "error-1",
          message: "Something went wrong",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("error")
      expect((result[0] as any).error).toBe("Something went wrong")
    })

    it("returns empty array for item.completed with no item", () => {
      expect(convertCodexEvent({ type: "item.completed" })).toEqual([])
    })

    it("returns empty array for item.completed with unsupported item type", () => {
      const event = {
        type: "item.completed",
        item: { type: "unsupported", id: "x" },
      }
      expect(convertCodexEvent(event)).toEqual([])
    })
  })

  describe("item.updated events", () => {
    it("converts command_execution streaming output", () => {
      const event = {
        type: "item.updated",
        item: {
          type: "command_execution",
          id: "cmd-streaming",
          command: "npm install",
          aggregated_output: "Installing packages...",
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("tool_use")
      expect((result[0] as any).tool).toBe("Bash")
      expect((result[0] as any).output).toBe("Installing packages...")
      expect((result[0] as any).status).toBe("running")
    })

    it("returns empty array for item.updated with no item", () => {
      expect(convertCodexEvent({ type: "item.updated" })).toEqual([])
    })

    it("returns empty array for item.updated with non-command item", () => {
      const event = {
        type: "item.updated",
        item: { type: "agent_message", id: "msg-1" },
      }
      expect(convertCodexEvent(event)).toEqual([])
    })
  })

  describe("turn.completed events", () => {
    it("converts turn.completed to result event with token usage", () => {
      const event = {
        type: "turn.completed",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 50,
          output_tokens: 75,
        },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("result")
      expect((result[0] as any).usage).toEqual({
        inputTokens: 150,
        outputTokens: 75,
        input_tokens: 150,
        output_tokens: 75,
      })
      expect(result[0].timestamp).toBeUndefined()
    })

    it("converts turn.completed with no cached tokens", () => {
      const event = {
        type: "turn.completed",
        usage: {
          input_tokens: 200,
          output_tokens: 100,
        },
      }
      const result = convertCodexEvent(event)
      expect((result[0] as any).usage).toEqual({
        inputTokens: 200,
        outputTokens: 100,
        input_tokens: 200,
        output_tokens: 100,
      })
    })

    it("converts turn.completed with no usage", () => {
      const event = { type: "turn.completed" }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("result")
      expect((result[0] as any).usage).toBeUndefined()
    })
  })

  describe("turn.failed events", () => {
    it("converts turn.failed to error event", () => {
      const event = {
        type: "turn.failed",
        error: { message: "Turn execution failed" },
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("error")
      expect((result[0] as any).error).toBe("Turn execution failed")
      expect(result[0].timestamp).toBeUndefined()
    })

    it("uses default message for turn.failed with no error", () => {
      const event = { type: "turn.failed" }
      const result = convertCodexEvent(event)
      expect((result[0] as any).error).toBe("Codex turn failed")
    })
  })

  describe("error events", () => {
    it("converts top-level error event", () => {
      const event = {
        type: "error",
        message: "Critical error occurred",
      }
      const result = convertCodexEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("error")
      expect((result[0] as any).error).toBe("Critical error occurred")
    })

    it("uses default message for error with no message", () => {
      const event = { type: "error" }
      const result = convertCodexEvent(event)
      expect((result[0] as any).error).toBe("Unknown error")
    })

    it("uses default message for error with non-string message", () => {
      const event = { type: "error", message: 123 }
      const result = convertCodexEvent(event)
      expect((result[0] as any).error).toBe("Unknown error")
    })
  })
})

describe("createCodexAdapter", () => {
  it("returns an adapter with correct meta", () => {
    const adapter = createCodexAdapter()
    expect(adapter.meta.name).toBe("codex")
    expect(adapter.meta.displayName).toBe("Codex")
  })

  it("convertEvent delegates to convertCodexEvent", () => {
    const adapter = createCodexAdapter()
    const event = {
      type: "item.completed",
      item: { type: "agent_message", id: "msg-1", text: "Hello" },
    }
    const result = adapter.convertEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("assistant")
  })

  it("convertEvents handles batch conversion", () => {
    const adapter = createCodexAdapter()
    const events = [
      { type: "item.completed", item: { type: "agent_message", id: "msg-1", text: "Hello" } },
      { type: "error", message: "oops" },
      { type: "unknown" },
    ]
    const result = adapter.convertEvents(events)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("assistant")
    expect(result[1].type).toBe("error")
  })

  it("convertEvents flattens results correctly", () => {
    const adapter = createCodexAdapter()
    const events = [
      {
        type: "turn.completed",
        usage: { input_tokens: 100, output_tokens: 50 },
      },
      { type: "thread.started" },
      { type: "item.completed", item: { type: "agent_message", id: "msg-1", text: "Done" } },
    ]
    const result = adapter.convertEvents(events)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("result")
    expect(result[1].type).toBe("assistant")
  })
})
