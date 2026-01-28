import { describe, it, expect } from "vitest"
import { buildToolResultsMap } from "./buildToolResultsMap"
import type { ChatEvent } from "@/types"

const toolResultEvent = (
  content: unknown[],
): ChatEvent => ({
  type: "user",
  timestamp: Date.now(),
  tool_use_result: true,
  message: { content },
})

describe("buildToolResultsMap", () => {
  it("returns empty map and false for empty events array", () => {
    const result = buildToolResultsMap([])
    expect(result.toolResults.size).toBe(0)
    expect(result.hasStructuredLifecycleEvents).toBe(false)
  })

  it("populates map from tool result events", () => {
    const events: ChatEvent[] = [
      toolResultEvent([
        { type: "tool_result", tool_use_id: "tool-1", content: "success output" },
        { type: "tool_result", tool_use_id: "tool-2", content: "another output" },
      ]),
    ]

    const { toolResults } = buildToolResultsMap(events)
    expect(toolResults.size).toBe(2)
    expect(toolResults.get("tool-1")).toEqual({ output: "success output", error: undefined })
    expect(toolResults.get("tool-2")).toEqual({ output: "another output", error: undefined })
  })

  it("sets error field for error tool results with string content", () => {
    const events: ChatEvent[] = [
      toolResultEvent([
        { type: "tool_result", tool_use_id: "err-1", content: "something failed", is_error: true },
      ]),
    ]

    const { toolResults } = buildToolResultsMap(events)
    expect(toolResults.get("err-1")).toEqual({
      output: "something failed",
      error: "something failed",
    })
  })

  it("sets error to 'Error' for error tool results with non-string content", () => {
    const events: ChatEvent[] = [
      toolResultEvent([
        { type: "tool_result", tool_use_id: "err-2", content: { some: "object" }, is_error: true },
      ]),
    ]

    const { toolResults } = buildToolResultsMap(events)
    expect(toolResults.get("err-2")).toEqual({ output: undefined, error: "Error" })
  })

  it("detects ralph_task_started lifecycle events", () => {
    const events: ChatEvent[] = [
      { type: "ralph_task_started", timestamp: 1 },
    ]

    const { hasStructuredLifecycleEvents } = buildToolResultsMap(events)
    expect(hasStructuredLifecycleEvents).toBe(true)
  })

  it("detects ralph_task_completed lifecycle events", () => {
    const events: ChatEvent[] = [
      { type: "ralph_task_completed", timestamp: 1 },
    ]

    const { hasStructuredLifecycleEvents } = buildToolResultsMap(events)
    expect(hasStructuredLifecycleEvents).toBe(true)
  })

  it("handles mixed events with both tool results and lifecycle events", () => {
    const events: ChatEvent[] = [
      { type: "ralph_task_started", timestamp: 1 },
      toolResultEvent([
        { type: "tool_result", tool_use_id: "t-1", content: "output" },
      ]),
      { type: "assistant_message", timestamp: 2, message: { content: [] } },
      { type: "ralph_task_completed", timestamp: 3 },
    ]

    const { toolResults, hasStructuredLifecycleEvents } = buildToolResultsMap(events)
    expect(toolResults.size).toBe(1)
    expect(toolResults.get("t-1")).toEqual({ output: "output", error: undefined })
    expect(hasStructuredLifecycleEvents).toBe(true)
  })

  it("skips events without message.content array", () => {
    const events: ChatEvent[] = [
      { type: "user", timestamp: 1, tool_use_result: true, message: { content: "just a string" } },
      { type: "user", timestamp: 2, tool_use_result: true, message: {} },
      { type: "user", timestamp: 3, tool_use_result: true },
    ]

    const { toolResults } = buildToolResultsMap(events)
    expect(toolResults.size).toBe(0)
  })

  it("skips content items that are not tool_result type", () => {
    const events: ChatEvent[] = [
      toolResultEvent([
        { type: "text", text: "hello" },
        { type: "tool_result", tool_use_id: "t-valid", content: "ok" },
      ]),
    ]

    const { toolResults } = buildToolResultsMap(events)
    expect(toolResults.size).toBe(1)
    expect(toolResults.has("t-valid")).toBe(true)
  })

  it("skips tool_result items without tool_use_id", () => {
    const events: ChatEvent[] = [
      toolResultEvent([
        { type: "tool_result", content: "no id" },
      ]),
    ]

    const { toolResults } = buildToolResultsMap(events)
    expect(toolResults.size).toBe(0)
  })

  it("does not flag lifecycle events for unrelated event types", () => {
    const events: ChatEvent[] = [
      { type: "user_message", timestamp: 1 },
      { type: "assistant_message", timestamp: 2, message: { content: [] } },
      { type: "error", timestamp: 3 },
    ]

    const { hasStructuredLifecycleEvents } = buildToolResultsMap(events)
    expect(hasStructuredLifecycleEvents).toBe(false)
  })
})
