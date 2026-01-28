import { describe, it, expect } from "vitest"
import {
  shouldFilterEventByType,
  shouldFilterContentBlock,
  hasRenderableContent,
  getFilterStats,
  type FilterContext,
} from "./EventFilterPipeline"
import type { ChatEvent, AssistantContentBlock } from "@/types"

describe("EventFilterPipeline", () => {
  // ==========================================================================
  // Layer 3: Event Type Filtering (shouldFilterEventByType)
  // ==========================================================================
  describe("shouldFilterEventByType", () => {
    describe("events that should be filtered", () => {
      it("filters tool_result events (type='user' with tool_use_result)", () => {
        const event: ChatEvent = {
          type: "user",
          timestamp: 1000,
          tool_use_result: { id: "tool_1", output: "result" },
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("tool_result_rendered_inline")
      })

      it("filters stream_event events", () => {
        const event: ChatEvent = {
          type: "stream_event",
          timestamp: 1000,
          data: { content: "streaming..." },
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("stream_event_processed_by_streaming")
      })

      it("filters system events", () => {
        const event: ChatEvent = {
          type: "system",
          timestamp: 1000,
          message: "internal system message",
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("system_event_internal")
      })

      it("filters unknown/unrecognized event types", () => {
        const event: ChatEvent = {
          type: "some_unknown_type",
          timestamp: 1000,
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("unrecognized_event_type")
      })

      it("does not filter user events without tool_use_result (regular user messages)", () => {
        const event: ChatEvent = {
          type: "user",
          timestamp: 1000,
          message: "Hello assistant",
        }

        const result = shouldFilterEventByType(event)

        // user type without tool_use_result should be filtered as unrecognized
        // since user_message is the proper type for user messages
        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("unrecognized_event_type")
      })
    })

    describe("events that should render", () => {
      it("renders user_message events", () => {
        const event: ChatEvent = {
          type: "user_message",
          timestamp: 1000,
          message: "Hello!",
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders ralph_task_started events", () => {
        const event: ChatEvent = {
          type: "ralph_task_started",
          timestamp: 1000,
          taskId: "task-123",
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders ralph_task_completed events", () => {
        const event: ChatEvent = {
          type: "ralph_task_completed",
          timestamp: 1000,
          taskId: "task-123",
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders assistant events", () => {
        const event: ChatEvent = {
          type: "assistant",
          timestamp: 1000,
          content: [{ type: "text", text: "Hello!" }],
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders error events", () => {
        const event: ChatEvent = {
          type: "error",
          timestamp: 1000,
          error: "Something went wrong",
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders server_error events", () => {
        const event: ChatEvent = {
          type: "server_error",
          timestamp: 1000,
          error: "Server connection failed",
        }

        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })
    })
  })

  // ==========================================================================
  // Layer 4: Content Block Filtering (shouldFilterContentBlock)
  // ==========================================================================
  describe("shouldFilterContentBlock", () => {
    describe("blocks that should render", () => {
      it("renders thinking blocks", () => {
        const block: AssistantContentBlock = {
          type: "thinking",
          thinking: "Let me think about this...",
        }
        const context: FilterContext = { hasStructuredLifecycleEvents: false }

        const result = shouldFilterContentBlock(block, false, context)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders text blocks", () => {
        const block: AssistantContentBlock = {
          type: "text",
          text: "Here is my response.",
        }
        const context: FilterContext = { hasStructuredLifecycleEvents: false }

        const result = shouldFilterContentBlock(block, false, context)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders tool_use blocks", () => {
        const block: AssistantContentBlock = {
          type: "tool_use",
          id: "tool_1",
          name: "Read",
          input: { file_path: "/test.ts" },
        }
        const context: FilterContext = { hasStructuredLifecycleEvents: false }

        const result = shouldFilterContentBlock(block, false, context)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("renders lifecycle text WITHOUT structured events", () => {
        const block: AssistantContentBlock = {
          type: "text",
          text: "[TASK_START:task-123]",
        }
        const context: FilterContext = { hasStructuredLifecycleEvents: false }

        // This is lifecycle text but no structured events exist
        const result = shouldFilterContentBlock(block, true, context)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })
    })

    describe("blocks that should be filtered", () => {
      it("filters lifecycle text WITH structured events", () => {
        const block: AssistantContentBlock = {
          type: "text",
          text: "[TASK_START:task-123]",
        }
        const context: FilterContext = { hasStructuredLifecycleEvents: true }

        // This is lifecycle text AND structured events exist - filter to avoid duplicates
        const result = shouldFilterContentBlock(block, true, context)

        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("lifecycle_text_has_structured_event")
      })

      it("filters unknown block types", () => {
        // Create an unknown block type using type assertion
        const block = {
          type: "custom_unknown_type",
          data: "some data",
        } as unknown as AssistantContentBlock
        const context: FilterContext = { hasStructuredLifecycleEvents: false }

        const result = shouldFilterContentBlock(block, false, context)

        expect(result.shouldRender).toBe(false)
        expect(result.reason).toBe("unrecognized_content_block_type")
      })
    })

    describe("edge cases", () => {
      it("renders non-lifecycle text even when structured events exist", () => {
        const block: AssistantContentBlock = {
          type: "text",
          text: "This is a regular text message, not a lifecycle event.",
        }
        const context: FilterContext = { hasStructuredLifecycleEvents: true }

        // Not lifecycle text, so should render regardless of hasStructuredLifecycleEvents
        const result = shouldFilterContentBlock(block, false, context)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })

      it("handles context with undefined hasStructuredLifecycleEvents", () => {
        const block: AssistantContentBlock = {
          type: "text",
          text: "[TASK_START:task-123]",
        }
        const context: FilterContext = {}

        // When hasStructuredLifecycleEvents is undefined (falsy), lifecycle text should render
        const result = shouldFilterContentBlock(block, true, context)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      })
    })
  })

  // ==========================================================================
  // Aggregate: hasRenderableContent
  // ==========================================================================
  describe("hasRenderableContent", () => {
    const mockParseLifecycle = (text: string): boolean => {
      return text.startsWith("[TASK_START:") || text.startsWith("[TASK_COMPLETE:")
    }

    it("returns false for empty array", () => {
      const result = hasRenderableContent([], {}, mockParseLifecycle)

      expect(result).toBe(false)
    })

    it("returns false for undefined content", () => {
      const result = hasRenderableContent(undefined, {}, mockParseLifecycle)

      expect(result).toBe(false)
    })

    it("returns false when all blocks are filtered", () => {
      const content: AssistantContentBlock[] = [
        { type: "text", text: "[TASK_START:task-123]" },
        { type: "text", text: "[TASK_COMPLETE:task-123]" },
      ]
      const context: FilterContext = { hasStructuredLifecycleEvents: true }

      const result = hasRenderableContent(content, context, mockParseLifecycle)

      expect(result).toBe(false)
    })

    it("returns true when at least one block is renderable", () => {
      const content: AssistantContentBlock[] = [
        { type: "text", text: "[TASK_START:task-123]" }, // filtered
        { type: "text", text: "This is regular text" }, // renderable
      ]
      const context: FilterContext = { hasStructuredLifecycleEvents: true }

      const result = hasRenderableContent(content, context, mockParseLifecycle)

      expect(result).toBe(true)
    })

    it("returns true for array with only renderable blocks", () => {
      const content: AssistantContentBlock[] = [
        { type: "text", text: "Hello!" },
        { type: "thinking", thinking: "Let me think..." },
        { type: "tool_use", id: "tool_1", name: "Read", input: {} },
      ]
      const context: FilterContext = { hasStructuredLifecycleEvents: false }

      const result = hasRenderableContent(content, context, mockParseLifecycle)

      expect(result).toBe(true)
    })

    it("returns true when lifecycle text exists but no structured events", () => {
      const content: AssistantContentBlock[] = [
        { type: "text", text: "[TASK_START:task-123]" },
      ]
      const context: FilterContext = { hasStructuredLifecycleEvents: false }

      const result = hasRenderableContent(content, context, mockParseLifecycle)

      expect(result).toBe(true)
    })

    it("handles mixed unknown and known block types", () => {
      const content: AssistantContentBlock[] = [
        { type: "unknown_type", data: "blah" } as unknown as AssistantContentBlock, // filtered
        { type: "text", text: "Hello" }, // renderable
      ]
      const context: FilterContext = {}

      const result = hasRenderableContent(content, context, mockParseLifecycle)

      expect(result).toBe(true)
    })

    it("returns false for array with only unknown block types", () => {
      const content = [
        { type: "unknown_type_1", data: "blah" } as unknown as AssistantContentBlock,
        { type: "unknown_type_2", data: "blah" } as unknown as AssistantContentBlock,
      ]
      const context: FilterContext = {}

      const result = hasRenderableContent(content, context, mockParseLifecycle)

      expect(result).toBe(false)
    })
  })

  // ==========================================================================
  // Aggregate: getFilterStats
  // ==========================================================================
  describe("getFilterStats", () => {
    it("correctly counts rendered events", () => {
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: 1000, message: "Hello" },
        { type: "assistant", timestamp: 2000, content: [] },
        { type: "error", timestamp: 3000, error: "Oops" },
      ]

      const stats = getFilterStats(events)

      expect(stats.rendered).toBe(3)
    })

    it("correctly counts tool_result filtered events", () => {
      const events: ChatEvent[] = [
        { type: "user", timestamp: 1000, tool_use_result: { id: "1", output: "result" } },
        { type: "user", timestamp: 2000, tool_use_result: { id: "2", output: "result" } },
      ]

      const stats = getFilterStats(events)

      expect(stats.tool_result_rendered_inline).toBe(2)
      expect(stats.rendered).toBe(0)
    })

    it("correctly counts stream_event filtered events", () => {
      const events: ChatEvent[] = [
        { type: "stream_event", timestamp: 1000, data: {} },
        { type: "stream_event", timestamp: 2000, data: {} },
        { type: "stream_event", timestamp: 3000, data: {} },
      ]

      const stats = getFilterStats(events)

      expect(stats.stream_event_processed_by_streaming).toBe(3)
      expect(stats.rendered).toBe(0)
    })

    it("correctly counts system event filtered events", () => {
      const events: ChatEvent[] = [
        { type: "system", timestamp: 1000, message: "internal" },
      ]

      const stats = getFilterStats(events)

      expect(stats.system_event_internal).toBe(1)
      expect(stats.rendered).toBe(0)
    })

    it("correctly counts unrecognized event types", () => {
      const events: ChatEvent[] = [
        { type: "unknown_type_1", timestamp: 1000 },
        { type: "unknown_type_2", timestamp: 2000 },
      ]

      const stats = getFilterStats(events)

      expect(stats.unrecognized_event_type).toBe(2)
      expect(stats.rendered).toBe(0)
    })

    it("correctly counts mixed event types", () => {
      const events: ChatEvent[] = [
        // Renderable events
        { type: "user_message", timestamp: 1000, message: "Hello" },
        { type: "assistant", timestamp: 2000, content: [] },
        { type: "ralph_task_started", timestamp: 3000, taskId: "task-1" },
        { type: "ralph_task_completed", timestamp: 4000, taskId: "task-1" },
        { type: "error", timestamp: 5000, error: "Error" },
        { type: "server_error", timestamp: 6000, error: "Server error" },

        // Filtered events
        { type: "user", timestamp: 7000, tool_use_result: { id: "1", output: "result" } },
        { type: "stream_event", timestamp: 8000, data: {} },
        { type: "system", timestamp: 9000, message: "internal" },
        { type: "unknown_type", timestamp: 10000 },
      ]

      const stats = getFilterStats(events)

      expect(stats.rendered).toBe(6)
      expect(stats.tool_result_rendered_inline).toBe(1)
      expect(stats.stream_event_processed_by_streaming).toBe(1)
      expect(stats.system_event_internal).toBe(1)
      expect(stats.unrecognized_event_type).toBe(1)
    })

    it("returns only rendered count for empty events array", () => {
      const events: ChatEvent[] = []

      const stats = getFilterStats(events)

      expect(stats.rendered).toBe(0)
      // No filter reasons should be present since no events were filtered
      expect(Object.keys(stats)).toEqual(["rendered"])
    })

    it("handles events with duplicate filter reasons", () => {
      const events: ChatEvent[] = [
        { type: "system", timestamp: 1000, message: "msg1" },
        { type: "system", timestamp: 2000, message: "msg2" },
        { type: "system", timestamp: 3000, message: "msg3" },
        { type: "stream_event", timestamp: 4000, data: {} },
        { type: "stream_event", timestamp: 5000, data: {} },
      ]

      const stats = getFilterStats(events)

      expect(stats.system_event_internal).toBe(3)
      expect(stats.stream_event_processed_by_streaming).toBe(2)
      expect(stats.rendered).toBe(0)
    })
  })

  // ==========================================================================
  // Integration-style tests
  // ==========================================================================
  describe("integration scenarios", () => {
    it("filters duplicate lifecycle displays correctly", () => {
      // Scenario: Event has lifecycle text in assistant content AND separate structured events

      // With structured events, lifecycle text is filtered
      const contextWithStructured: FilterContext = { hasStructuredLifecycleEvents: true }
      const lifecycleBlock: AssistantContentBlock = { type: "text", text: "[TASK_START:123]" }

      expect(
        shouldFilterContentBlock(lifecycleBlock, true, contextWithStructured).shouldRender,
      ).toBe(false)

      // Without structured events, lifecycle text renders
      const contextWithoutStructured: FilterContext = { hasStructuredLifecycleEvents: false }

      expect(
        shouldFilterContentBlock(lifecycleBlock, true, contextWithoutStructured).shouldRender,
      ).toBe(true)
    })

    it("allows all renderable event types through the filter", () => {
      const renderableTypes = [
        "user_message",
        "ralph_task_started",
        "ralph_task_completed",
        "assistant",
        "error",
        "server_error",
      ]

      for (const type of renderableTypes) {
        const event: ChatEvent = { type, timestamp: 1000 }
        const result = shouldFilterEventByType(event)

        expect(result.shouldRender).toBe(true)
        expect(result.reason).toBeUndefined()
      }
    })

    it("allows all renderable content block types through the filter", () => {
      const context: FilterContext = { hasStructuredLifecycleEvents: false }

      const textBlock: AssistantContentBlock = { type: "text", text: "Hello" }
      const thinkingBlock: AssistantContentBlock = { type: "thinking", thinking: "Hmm..." }
      const toolUseBlock: AssistantContentBlock = {
        type: "tool_use",
        id: "1",
        name: "Read",
        input: {},
      }

      expect(shouldFilterContentBlock(textBlock, false, context).shouldRender).toBe(true)
      expect(shouldFilterContentBlock(thinkingBlock, false, context).shouldRender).toBe(true)
      expect(shouldFilterContentBlock(toolUseBlock, false, context).shouldRender).toBe(true)
    })
  })
})
