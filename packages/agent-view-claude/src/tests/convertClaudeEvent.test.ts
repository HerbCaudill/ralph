import { describe, it, expect } from "vitest"
import { convertClaudeEvent } from ".././convertClaudeEvent"
import { createClaudeAdapter } from ".././createClaudeAdapter"

describe("convertClaudeEvent", () => {
  it("returns empty array for null input", () => {
    expect(convertClaudeEvent(null)).toEqual([])
  })

  it("returns empty array for non-object input", () => {
    expect(convertClaudeEvent("hello")).toEqual([])
    expect(convertClaudeEvent(42)).toEqual([])
  })

  it("returns empty array for unrecognized event type", () => {
    expect(convertClaudeEvent({ type: "unknown_type" })).toEqual([])
  })

  it("returns empty array for missing type", () => {
    expect(convertClaudeEvent({ message: "no type" })).toEqual([])
  })

  it("passes through assistant events", () => {
    const event = {
      type: "assistant",
      timestamp: 1000,
      message: { content: [{ type: "text", text: "Hello" }] },
    }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("assistant")
    expect(result[0].timestamp).toBe(1000)
    expect((result[0] as any).message.content[0].text).toBe("Hello")
  })

  it("passes through stream_event events", () => {
    const event = {
      type: "stream_event",
      timestamp: 2000,
      event: { type: "content_block_delta", delta: { text: "hi" } },
    }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("stream_event")
  })

  it("passes through user events", () => {
    const event = {
      type: "user",
      timestamp: 3000,
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "123" }] },
    }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("user")
  })

  it("passes through error events", () => {
    const event = { type: "error", timestamp: 4000, error: "something went wrong" }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("error")
    expect((result[0] as any).error).toBe("something went wrong")
  })

  it("passes through result events and normalizes usage", () => {
    const event = {
      type: "result",
      timestamp: 5000,
      usage: { input_tokens: 100, output_tokens: 50 },
    }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("result")
    const usage = (result[0] as any).usage
    expect(usage.input_tokens).toBe(100)
    expect(usage.output_tokens).toBe(50)
    expect(usage.inputTokens).toBe(100)
    expect(usage.outputTokens).toBe(50)
  })

  it("normalizes usage with camelCase input", () => {
    const event = {
      type: "result",
      timestamp: 5000,
      usage: { inputTokens: 200, outputTokens: 80 },
    }
    const result = convertClaudeEvent(event)
    const usage = (result[0] as any).usage
    expect(usage.inputTokens).toBe(200)
    expect(usage.outputTokens).toBe(80)
    expect(usage.input_tokens).toBe(200)
    expect(usage.output_tokens).toBe(80)
  })

  it("leaves timestamp undefined when not present", () => {
    const event = { type: "assistant", message: { content: [] } }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].timestamp).toBeUndefined()
  })

  it("passes through system events", () => {
    const event = { type: "system", timestamp: 6000, subtype: "init" }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("system")
  })

  it("passes through ralph lifecycle events", () => {
    for (const type of [
      "ralph_task_started",
      "ralph_task_completed",
      "ralph_session_start",
      "ralph_session_end",
    ]) {
      const event = { type, timestamp: 7000, taskId: "t-123" }
      const result = convertClaudeEvent(event)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(type)
    }
  })

  it("passes through tool_use events", () => {
    const event = {
      type: "tool_use",
      timestamp: 8000,
      tool: "Read",
      input: { file_path: "/foo/bar.ts" },
      status: "success",
    }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("tool_use")
  })

  it("passes through user_message events", () => {
    const event = { type: "user_message", timestamp: 9000, message: "hello there" }
    const result = convertClaudeEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("user_message")
  })
})

describe("createClaudeAdapter", () => {
  it("returns an adapter with correct meta", () => {
    const adapter = createClaudeAdapter()
    expect(adapter.meta.name).toBe("claude")
    expect(adapter.meta.displayName).toBe("Claude")
  })

  it("convertEvent delegates to convertClaudeEvent", () => {
    const adapter = createClaudeAdapter()
    const event = { type: "assistant", timestamp: 1000, message: { content: [] } }
    const result = adapter.convertEvent(event)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("assistant")
  })

  it("convertEvents handles batch conversion", () => {
    const adapter = createClaudeAdapter()
    const events = [
      { type: "assistant", timestamp: 1000, message: { content: [] } },
      { type: "error", timestamp: 2000, error: "oops" },
      { type: "unknown", timestamp: 3000 },
    ]
    const result = adapter.convertEvents(events)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("assistant")
    expect(result[1].type).toBe("error")
  })
})
