import { describe, it, expect, beforeEach } from "vitest"
import {
  eventToBlocks,
  EventBlockConverter,
  mergeToolResult,
  toAssistantTextEvent,
  toToolUseEvent,
  type DisplayBlock,
  type TextBlock,
  type ToolUseBlock,
} from ".././eventToBlocks"
import type { AgentEvent, AgentToolResultEvent } from "../../../server/AgentAdapter"
import {
  isAgentMessageEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "../../../server/AgentAdapter"

describe("eventToBlocks", () => {
  describe("basic event processing", () => {
    it("converts a message event to a text block", () => {
      const events: AgentEvent[] = [
        {
          type: "message",
          timestamp: 1000,
          content: "Hello, world!",
          isPartial: false,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        type: "text",
        timestamp: 1000,
        content: "Hello, world!",
      })
    })

    it("converts a tool_use event to a tool_use block", () => {
      const events: AgentEvent[] = [
        {
          type: "tool_use",
          timestamp: 1000,
          toolUseId: "tool_1",
          tool: "Read",
          input: { file_path: "/test/file.ts" },
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        type: "tool_use",
        timestamp: 1000,
        toolUseId: "tool_1",
        tool: "Read",
        input: { file_path: "/test/file.ts" },
        status: "running",
      })
    })

    it("converts a tool_result event and updates the tool_use block", () => {
      const events: AgentEvent[] = [
        {
          type: "tool_use",
          timestamp: 1000,
          toolUseId: "tool_1",
          tool: "Read",
          input: { file_path: "/test/file.ts" },
        },
        {
          type: "tool_result",
          timestamp: 1100,
          toolUseId: "tool_1",
          output: "file contents here",
          isError: false,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(2)
      // First block is the initial tool_use
      expect(blocks[0].type).toBe("tool_use")
      expect((blocks[0] as ToolUseBlock).status).toBe("running")
      // Second block is the updated tool_use with result
      expect(blocks[1]).toEqual({
        type: "tool_use",
        timestamp: 1100,
        toolUseId: "tool_1",
        tool: "Read",
        input: { file_path: "/test/file.ts" },
        output: "file contents here",
        status: "success",
      })
    })

    it("handles error tool results", () => {
      const events: AgentEvent[] = [
        {
          type: "tool_use",
          timestamp: 1000,
          toolUseId: "tool_1",
          tool: "Read",
          input: { file_path: "/nonexistent.ts" },
        },
        {
          type: "tool_result",
          timestamp: 1100,
          toolUseId: "tool_1",
          error: "File not found",
          isError: true,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(2)
      expect((blocks[1] as ToolUseBlock).status).toBe("error")
      expect((blocks[1] as ToolUseBlock).error).toBe("File not found")
    })

    it("converts an error event to an error block", () => {
      const events: AgentEvent[] = [
        {
          type: "error",
          timestamp: 1000,
          message: "Something went wrong",
          code: "E001",
          fatal: true,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        type: "error",
        timestamp: 1000,
        message: "Something went wrong",
        code: "E001",
        fatal: true,
      })
    })
  })

  describe("streaming message handling", () => {
    it("accumulates partial messages", () => {
      const events: AgentEvent[] = [
        {
          type: "message",
          timestamp: 1000,
          content: "Hello",
          isPartial: true,
        },
        {
          type: "message",
          timestamp: 1001,
          content: ", world",
          isPartial: true,
        },
        {
          type: "message",
          timestamp: 1002,
          content: "!",
          isPartial: true,
        },
      ]

      const blocks = eventToBlocks(events)

      // Streaming content should be accumulated and emitted at the end
      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        type: "text",
        timestamp: expect.any(Number),
        content: "Hello, world!",
      })
    })

    it("flushes streaming content before tool use", () => {
      const events: AgentEvent[] = [
        {
          type: "message",
          timestamp: 1000,
          content: "Let me check that file.",
          isPartial: true,
        },
        {
          type: "tool_use",
          timestamp: 1100,
          toolUseId: "tool_1",
          tool: "Read",
          input: { file_path: "/test.ts" },
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe("text")
      expect((blocks[0] as TextBlock).content).toBe("Let me check that file.")
      expect(blocks[1].type).toBe("tool_use")
    })

    it("handles complete message after partial streaming", () => {
      const events: AgentEvent[] = [
        {
          type: "message",
          timestamp: 1000,
          content: "Complete message",
          isPartial: false,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(1)
      expect((blocks[0] as TextBlock).content).toBe("Complete message")
    })
  })

  describe("status events", () => {
    it("excludes status events by default", () => {
      const events: AgentEvent[] = [
        {
          type: "status",
          timestamp: 1000,
          status: "running",
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(0)
    })

    it("includes status events when option is set", () => {
      const events: AgentEvent[] = [
        {
          type: "status",
          timestamp: 1000,
          status: "running",
        },
      ]

      const blocks = eventToBlocks(events, { includeStatusEvents: true })

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        type: "status",
        timestamp: 1000,
        status: "running",
      })
    })
  })

  describe("complex scenarios", () => {
    it("handles a typical conversation flow", () => {
      const events: AgentEvent[] = [
        // User asks to read a file (not in AgentEvents, but could be)
        {
          type: "message",
          timestamp: 1000,
          content: "I'll read that file for you.",
          isPartial: false,
        },
        {
          type: "tool_use",
          timestamp: 1100,
          toolUseId: "tool_1",
          tool: "Read",
          input: { file_path: "/project/src/index.ts" },
        },
        {
          type: "tool_result",
          timestamp: 1200,
          toolUseId: "tool_1",
          output: "const x = 1;",
          isError: false,
        },
        {
          type: "message",
          timestamp: 1300,
          content: "The file contains a simple constant declaration.",
          isPartial: false,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(4)
      expect(blocks[0].type).toBe("text")
      expect(blocks[1].type).toBe("tool_use")
      expect((blocks[1] as ToolUseBlock).status).toBe("running")
      expect(blocks[2].type).toBe("tool_use")
      expect((blocks[2] as ToolUseBlock).status).toBe("success")
      expect((blocks[2] as ToolUseBlock).output).toBe("const x = 1;")
      expect(blocks[3].type).toBe("text")
    })

    it("skips empty messages", () => {
      const events: AgentEvent[] = [
        {
          type: "message",
          timestamp: 1000,
          content: "   ",
          isPartial: false,
        },
        {
          type: "message",
          timestamp: 1001,
          content: "",
          isPartial: false,
        },
      ]

      const blocks = eventToBlocks(events)

      expect(blocks).toHaveLength(0)
    })
  })
})

describe("EventBlockConverter", () => {
  let converter: EventBlockConverter

  beforeEach(() => {
    converter = new EventBlockConverter()
  })

  it("processes events incrementally", () => {
    const blocks1 = converter.processEvent({
      type: "message",
      timestamp: 1000,
      content: "Hello",
      isPartial: true,
    })

    // Partial messages don't emit blocks immediately
    expect(blocks1).toHaveLength(0)

    const blocks2 = converter.processEvent({
      type: "message",
      timestamp: 1100,
      content: ", world!",
      isPartial: false,
    })

    // Complete message does emit
    expect(blocks2).toHaveLength(1)
    expect((blocks2[0] as TextBlock).content).toBe(", world!")
  })

  it("returns streaming block for in-progress content", () => {
    converter.processEvent({
      type: "message",
      timestamp: 1000,
      content: "Streaming...",
      isPartial: true,
    })

    const streamingBlock = converter.getStreamingBlock()

    expect(streamingBlock).not.toBeNull()
    expect(streamingBlock?.content).toBe("Streaming...")
  })

  it("returns pending tool uses", () => {
    converter.processEvent({
      type: "tool_use",
      timestamp: 1000,
      toolUseId: "tool_1",
      tool: "Bash",
      input: { command: "ls" },
    })

    const pending = converter.getPendingToolUses()

    expect(pending).toHaveLength(1)
    expect(pending[0].toolUseId).toBe("tool_1")
    expect(pending[0].status).toBe("running")
  })

  it("removes pending tool use after result", () => {
    converter.processEvent({
      type: "tool_use",
      timestamp: 1000,
      toolUseId: "tool_1",
      tool: "Bash",
      input: { command: "ls" },
    })

    converter.processEvent({
      type: "tool_result",
      timestamp: 1100,
      toolUseId: "tool_1",
      output: "file1.ts\nfile2.ts",
      isError: false,
    })

    const pending = converter.getPendingToolUses()

    expect(pending).toHaveLength(0)
  })

  it("resets state correctly", () => {
    converter.processEvent({
      type: "message",
      timestamp: 1000,
      content: "Some content",
      isPartial: true,
    })

    converter.processEvent({
      type: "tool_use",
      timestamp: 1100,
      toolUseId: "tool_1",
      tool: "Read",
      input: {},
    })

    converter.reset()

    expect(converter.getStreamingBlock()).toBeNull()
    expect(converter.getPendingToolUses()).toHaveLength(0)
  })
})

describe("mergeToolResult", () => {
  it("updates matching tool_use block with result", () => {
    const blocks: DisplayBlock[] = [
      {
        type: "text",
        timestamp: 900,
        content: "Let me check that.",
      },
      {
        type: "tool_use",
        timestamp: 1000,
        toolUseId: "tool_1",
        tool: "Read",
        input: { file_path: "/test.ts" },
        status: "running",
      },
    ]

    const result: AgentToolResultEvent = {
      type: "tool_result",
      timestamp: 1100,
      toolUseId: "tool_1",
      output: "file contents",
      isError: false,
    }

    const updated = mergeToolResult(blocks, result)

    expect(updated).toHaveLength(2)
    expect(updated[0]).toEqual(blocks[0]) // text unchanged
    expect((updated[1] as ToolUseBlock).status).toBe("success")
    expect((updated[1] as ToolUseBlock).output).toBe("file contents")
  })

  it("handles error results", () => {
    const blocks: DisplayBlock[] = [
      {
        type: "tool_use",
        timestamp: 1000,
        toolUseId: "tool_1",
        tool: "Read",
        input: {},
        status: "running",
      },
    ]

    const result: AgentToolResultEvent = {
      type: "tool_result",
      timestamp: 1100,
      toolUseId: "tool_1",
      error: "File not found",
      isError: true,
    }

    const updated = mergeToolResult(blocks, result)

    expect((updated[0] as ToolUseBlock).status).toBe("error")
    expect((updated[0] as ToolUseBlock).error).toBe("File not found")
  })

  it("leaves non-matching blocks unchanged", () => {
    const blocks: DisplayBlock[] = [
      {
        type: "tool_use",
        timestamp: 1000,
        toolUseId: "tool_1",
        tool: "Read",
        input: {},
        status: "running",
      },
    ]

    const result: AgentToolResultEvent = {
      type: "tool_result",
      timestamp: 1100,
      toolUseId: "tool_OTHER",
      output: "result",
      isError: false,
    }

    const updated = mergeToolResult(blocks, result)

    expect((updated[0] as ToolUseBlock).status).toBe("running")
  })
})

describe("conversion helpers", () => {
  describe("toAssistantTextEvent", () => {
    it("converts TextBlock to AssistantTextEvent", () => {
      const block: TextBlock = {
        type: "text",
        timestamp: 1000,
        content: "Hello!",
      }

      const event = toAssistantTextEvent(block)

      expect(event).toEqual({
        type: "text",
        timestamp: 1000,
        content: "Hello!",
      })
    })
  })

  describe("toToolUseEvent", () => {
    it("converts ToolUseBlock to ToolUseEvent", () => {
      const block: ToolUseBlock = {
        type: "tool_use",
        timestamp: 1000,
        toolUseId: "tool_1",
        tool: "Bash",
        input: { command: "ls" },
        output: "files",
        status: "success",
      }

      const event = toToolUseEvent(block)

      expect(event).toEqual({
        type: "tool_use",
        timestamp: 1000,
        tool: "Bash",
        input: { command: "ls" },
        output: "files",
        status: "success",
      })
    })
  })
})

describe("type guards", () => {
  it("isAgentMessageEvent identifies message events", () => {
    const event: AgentEvent = { type: "message", timestamp: 0, content: "", isPartial: false }
    expect(isAgentMessageEvent(event)).toBe(true)
  })

  it("isAgentToolUseEvent identifies tool_use events", () => {
    const event: AgentEvent = {
      type: "tool_use",
      timestamp: 0,
      toolUseId: "",
      tool: "",
      input: {},
    }
    expect(isAgentToolUseEvent(event)).toBe(true)
  })

  it("isAgentToolResultEvent identifies tool_result events", () => {
    const event: AgentEvent = { type: "tool_result", timestamp: 0, toolUseId: "", isError: false }
    expect(isAgentToolResultEvent(event)).toBe(true)
  })

  it("isAgentResultEvent identifies result events", () => {
    const event: AgentEvent = { type: "result", timestamp: 0, content: "" }
    expect(isAgentResultEvent(event)).toBe(true)
  })

  it("isAgentErrorEvent identifies error events", () => {
    const event: AgentEvent = { type: "error", timestamp: 0, message: "", fatal: false }
    expect(isAgentErrorEvent(event)).toBe(true)
  })

  it("isAgentStatusEvent identifies status events", () => {
    const event: AgentEvent = { type: "status", timestamp: 0, status: "idle" }
    expect(isAgentStatusEvent(event)).toBe(true)
  })
})
