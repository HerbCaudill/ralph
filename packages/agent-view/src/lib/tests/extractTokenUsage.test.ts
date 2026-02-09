import { describe, it, expect } from "vitest"
import { extractTokenUsageFromEvent, aggregateTokenUsage } from ".././extractTokenUsage"
import type { ChatEvent } from "../../types"

describe("extractTokenUsageFromEvent", () => {
  it("extracts usage from stream_event with message_delta", () => {
    const event: ChatEvent = {
      type: "stream_event",
      event: {
        type: "message_delta",
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    }
    expect(extractTokenUsageFromEvent(event)).toEqual({ input: 100, output: 50 })
  })

  it("includes cache tokens in input total", () => {
    const event: ChatEvent = {
      type: "stream_event",
      event: {
        type: "message_delta",
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 200,
          cache_read_input_tokens: 300,
          output_tokens: 50,
        },
      },
    }
    expect(extractTokenUsageFromEvent(event)).toEqual({ input: 600, output: 50 })
  })

  it("extracts usage from result event with camelCase", () => {
    const event: ChatEvent = {
      type: "result",
      usage: { inputTokens: 1000, outputTokens: 500 },
    }
    expect(extractTokenUsageFromEvent(event)).toEqual({ input: 1000, output: 500 })
  })

  it("extracts usage from result event with snake_case", () => {
    const event: ChatEvent = {
      type: "result",
      usage: { input_tokens: 1000, output_tokens: 500 },
    }
    expect(extractTokenUsageFromEvent(event)).toEqual({ input: 1000, output: 500 })
  })

  it("returns null for events without usage", () => {
    expect(extractTokenUsageFromEvent({ type: "assistant" })).toBeNull()
    expect(extractTokenUsageFromEvent({ type: "user" })).toBeNull()
  })

  it("returns null for stream_event without message_delta", () => {
    const event: ChatEvent = {
      type: "stream_event",
      event: { type: "content_block_start" },
    }
    expect(extractTokenUsageFromEvent(event)).toBeNull()
  })

  it("returns null for zero usage", () => {
    const event: ChatEvent = {
      type: "result",
      usage: { inputTokens: 0, outputTokens: 0 },
    }
    expect(extractTokenUsageFromEvent(event)).toBeNull()
  })

  it("extracts usage from turn_usage event", () => {
    const event: ChatEvent = {
      type: "turn_usage",
      usage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
    }
    expect(extractTokenUsageFromEvent(event)).toEqual({ input: 500, output: 200 })
  })

  it("returns null for turn_usage with zero usage", () => {
    const event: ChatEvent = {
      type: "turn_usage",
      usage: { inputTokens: 0, outputTokens: 0 },
    }
    expect(extractTokenUsageFromEvent(event)).toBeNull()
  })
})

describe("aggregateTokenUsage", () => {
  it("returns the most recent usage event", () => {
    const events: ChatEvent[] = [
      { type: "result", usage: { inputTokens: 100, outputTokens: 50 } },
      { type: "assistant" },
      { type: "result", usage: { inputTokens: 200, outputTokens: 75 } },
    ]
    expect(aggregateTokenUsage(events)).toEqual({ input: 200, output: 75 })
  })

  it("returns the latest turn_usage event (current context size)", () => {
    const events: ChatEvent[] = [
      { type: "turn_usage", usage: { inputTokens: 1000, outputTokens: 300 } },
      { type: "assistant" },
      { type: "tool_use" },
      { type: "turn_usage", usage: { inputTokens: 1200, outputTokens: 400 } },
      { type: "result" }, // result without usage (per-turn events cover it)
    ]
    expect(aggregateTokenUsage(events)).toEqual({ input: 1200, output: 400 })
  })

  it("returns zeros for empty array", () => {
    expect(aggregateTokenUsage([])).toEqual({ input: 0, output: 0 })
  })

  it("returns zeros when no events have usage", () => {
    const events: ChatEvent[] = [{ type: "assistant" }, { type: "user" }]
    expect(aggregateTokenUsage(events)).toEqual({ input: 0, output: 0 })
  })
})
