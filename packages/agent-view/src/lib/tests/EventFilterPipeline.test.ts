import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  isFilterDebugEnabled,
  shouldFilterEventByType,
  shouldFilterContentBlock,
  hasRenderableContent,
  getFilterStats,
} from ".././EventFilterPipeline"
import type { ChatEvent, AssistantContentBlock } from "../../types"

describe("EventFilterPipeline", () => {
  describe("isFilterDebugEnabled", () => {
    beforeEach(() => {
      if (typeof localStorage !== "undefined") {
        localStorage.clear()
      }
    })

    it("should return false by default", () => {
      expect(isFilterDebugEnabled()).toBe(false)
    })

    it("should return true when enabled", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ralph-filter-debug", "true")
        expect(isFilterDebugEnabled()).toBe(true)
      }
    })

    it("should return false for non-true values", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ralph-filter-debug", "false")
        expect(isFilterDebugEnabled()).toBe(false)
      }
    })
  })

  describe("shouldFilterEventByType", () => {
    it("should render user_message events", () => {
      const event: ChatEvent = { type: "user_message", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(true)
    })

    it("should render ralph_task_started events", () => {
      const event: ChatEvent = { type: "ralph_task_started", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(true)
    })

    it("should render ralph_task_completed events", () => {
      const event: ChatEvent = { type: "ralph_task_completed", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(true)
    })

    it("should render assistant events", () => {
      const event: ChatEvent = { type: "assistant", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(true)
    })

    it("should render error events", () => {
      const event: ChatEvent = { type: "error", timestamp: 123, error: "An error" }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(true)
    })

    it("should render server_error events", () => {
      const event: ChatEvent = { type: "server_error", timestamp: 123, error: "Server error" }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(true)
    })

    it("should filter tool result events", () => {
      const event: ChatEvent = {
        type: "user",
        timestamp: 123,
        tool_use_result: true,
      }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(false)
      expect(result.reason).toBe("tool_result_rendered_inline")
    })

    it("should filter stream_event events", () => {
      const event: ChatEvent = { type: "stream_event", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(false)
      expect(result.reason).toBe("stream_event_processed_by_streaming")
    })

    it("should filter system events", () => {
      const event: ChatEvent = { type: "system", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(false)
      expect(result.reason).toBe("system_event_internal")
    })

    it("should filter unrecognized event types", () => {
      const event: ChatEvent = { type: "unknown_type", timestamp: 123 }
      const result = shouldFilterEventByType(event)

      expect(result.shouldRender).toBe(false)
      expect(result.reason).toBe("unrecognized_event_type")
    })
  })

  describe("shouldFilterContentBlock", () => {
    it("should render text blocks", () => {
      const block: AssistantContentBlock = { type: "text", text: "Hello" }
      const result = shouldFilterContentBlock(block, false, {})

      expect(result.shouldRender).toBe(true)
    })

    it("should render thinking blocks", () => {
      const block: AssistantContentBlock = { type: "thinking", thinking: "Hmm..." }
      const result = shouldFilterContentBlock(block, false, {})

      expect(result.shouldRender).toBe(true)
    })

    it("should render tool_use blocks", () => {
      const block: AssistantContentBlock = { type: "tool_use", name: "Read", id: "tool-1" }
      const result = shouldFilterContentBlock(block, false, {})

      expect(result.shouldRender).toBe(true)
    })

    it("should filter lifecycle text when structured events exist", () => {
      const block: AssistantContentBlock = { type: "text", text: "<start_task>r-abc</start_task>" }
      const result = shouldFilterContentBlock(block, true, {
        hasStructuredLifecycleEvents: true,
      })

      expect(result.shouldRender).toBe(false)
      expect(result.reason).toBe("lifecycle_text_has_structured_event")
    })

    it("should render lifecycle text when no structured events exist", () => {
      const block: AssistantContentBlock = { type: "text", text: "<start_task>r-abc</start_task>" }
      const result = shouldFilterContentBlock(block, true, {
        hasStructuredLifecycleEvents: false,
      })

      expect(result.shouldRender).toBe(true)
    })

    it("should filter unrecognized block types", () => {
      const block: AssistantContentBlock = { type: "unknown", data: "test" } as any
      const result = shouldFilterContentBlock(block, false, {})

      expect(result.shouldRender).toBe(false)
      expect(result.reason).toBe("unrecognized_content_block_type")
    })
  })

  describe("hasRenderableContent", () => {
    it("should return true when content has renderable blocks", () => {
      const content: AssistantContentBlock[] = [{ type: "text", text: "Hello" }]
      const parseLifecycle = () => false
      const result = hasRenderableContent(content, {}, parseLifecycle)

      expect(result).toBe(true)
    })

    it("should return false when content is empty", () => {
      const result = hasRenderableContent([], {}, () => false)

      expect(result).toBe(false)
    })

    it("should return false when content is undefined", () => {
      const result = hasRenderableContent(undefined, {}, () => false)

      expect(result).toBe(false)
    })

    it("should return false when all blocks are filtered", () => {
      const content: AssistantContentBlock[] = [
        { type: "text", text: "<start_task>r-abc</start_task>" },
      ]
      const parseLifecycle = (text: string) => text.includes("<start_task>")
      const result = hasRenderableContent(
        content,
        { hasStructuredLifecycleEvents: true },
        parseLifecycle,
      )

      expect(result).toBe(false)
    })

    it("should return true when at least one block is renderable", () => {
      const content: AssistantContentBlock[] = [
        { type: "text", text: "<start_task>r-abc</start_task>" },
        { type: "text", text: "Regular text" },
      ]
      const parseLifecycle = (text: string) => text.includes("<start_task>")
      const result = hasRenderableContent(
        content,
        { hasStructuredLifecycleEvents: true },
        parseLifecycle,
      )

      expect(result).toBe(true)
    })
  })

  describe("getFilterStats", () => {
    it("should count rendered and filtered events", () => {
      const events: ChatEvent[] = [
        { type: "assistant", timestamp: 1 },
        { type: "stream_event", timestamp: 2 },
        { type: "user_message", timestamp: 3 },
        { type: "system", timestamp: 4 },
      ]

      const stats = getFilterStats(events)

      expect(stats.rendered).toBe(2)
      expect(stats.stream_event_processed_by_streaming).toBe(1)
      expect(stats.system_event_internal).toBe(1)
    })

    it("should handle empty events array", () => {
      const stats = getFilterStats([])

      expect(stats.rendered).toBe(0)
    })

    it("should count multiple instances of same filter reason", () => {
      const events: ChatEvent[] = [
        { type: "system", timestamp: 1 },
        { type: "system", timestamp: 2 },
        { type: "system", timestamp: 3 },
      ]

      const stats = getFilterStats(events)

      expect(stats.system_event_internal).toBe(3)
      expect(stats.rendered).toBe(0)
    })

    it("should track various filter reasons", () => {
      const events: ChatEvent[] = [
        { type: "user", timestamp: 1, tool_use_result: true },
        { type: "stream_event", timestamp: 2 },
        { type: "unknown", timestamp: 3 },
        { type: "assistant", timestamp: 4 },
      ]

      const stats = getFilterStats(events)

      expect(stats.tool_result_rendered_inline).toBe(1)
      expect(stats.stream_event_processed_by_streaming).toBe(1)
      expect(stats.unrecognized_event_type).toBe(1)
      expect(stats.rendered).toBe(1)
    })
  })
})
