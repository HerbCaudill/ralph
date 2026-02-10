import { describe, it, expect } from "vitest"
import { extractModelFromEvents } from "../extractModelFromEvents"
import type { ChatEvent } from "../../types"

describe("extractModelFromEvents", () => {
  it("returns undefined when no events have a model", () => {
    const events: ChatEvent[] = [{ type: "message", content: "Hello" }]
    expect(extractModelFromEvents(events)).toBeUndefined()
  })

  it("extracts model from turn_usage event", () => {
    const events: ChatEvent[] = [
      { type: "turn_usage", usage: { inputTokens: 100, outputTokens: 50 }, model: "claude-opus-4" },
    ]
    expect(extractModelFromEvents(events)).toBe("claude-opus-4")
  })

  it("returns the model from the last turn_usage event with a model", () => {
    const events: ChatEvent[] = [
      {
        type: "turn_usage",
        usage: { inputTokens: 100, outputTokens: 50 },
        model: "claude-sonnet-4",
      },
      { type: "assistant" },
      {
        type: "turn_usage",
        usage: { inputTokens: 200, outputTokens: 100 },
        model: "claude-opus-4",
      },
    ]
    expect(extractModelFromEvents(events)).toBe("claude-opus-4")
  })

  it("skips turn_usage events without a model field", () => {
    const events: ChatEvent[] = [
      {
        type: "turn_usage",
        usage: { inputTokens: 100, outputTokens: 50 },
        model: "claude-sonnet-4",
      },
      { type: "turn_usage", usage: { inputTokens: 200, outputTokens: 100 } }, // No model
    ]
    expect(extractModelFromEvents(events)).toBe("claude-sonnet-4")
  })
})
