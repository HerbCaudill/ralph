import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStreamingState } from "./useStreamingState"
import type { ChatEvent } from "@/types"

describe("useStreamingState", () => {
  describe("deduplication", () => {
    it("deduplicates assistant event that arrives after message_stop", () => {
      const events: ChatEvent[] = [
        // message_start begins streaming
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Content block
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        // message_stop - hook synthesizes assistant event here
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // SDK's assistant event - should be deduplicated (arrives within 1000ms of message_stop)
        {
          type: "assistant",
          timestamp: 350,
          message: { content: [{ type: "text", text: "Hello" }] },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have exactly 1 assistant event (the synthesized one)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
    })

    it("deduplicates when assistant arrives before message_stop by timestamp", () => {
      // This scenario: SDK sends assistant event with an earlier timestamp than message_stop
      // The events array is sorted by timestamp, so assistant comes before message_stop
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        // Assistant arrives BEFORE message_stop by timestamp
        {
          type: "assistant",
          timestamp: 280,
          message: { content: [{ type: "text", text: "Hello" }] },
        },
        // message_stop comes after
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have exactly 1 assistant event
      // BUG: Currently this results in 2 events because assistant arrives before
      // message_stop sets lastSynthesizedTimestamp
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
    })

    it("keeps both assistant events when they are far apart", () => {
      // Two separate messages - should not be deduplicated
      const events: ChatEvent[] = [
        // First message
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "First" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // Second message - far apart (more than 1000ms)
        {
          type: "assistant",
          timestamp: 2000,
          message: { content: [{ type: "text", text: "Second" }] },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have 2 assistant events (synthesized from streaming + later SDK event)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(2)
    })

    it("passes through assistant events when no streaming occurred", () => {
      // No message_start/message_stop - assistant event should pass through
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 100,
          message: { content: [{ type: "text", text: "Hello" }] },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
    })

    it("deduplicates using message ID when available", () => {
      // Test message ID-based deduplication (more reliable than timestamp)
      const messageId = "msg_test123"
      const events: ChatEvent[] = [
        // message_start includes message ID
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { id: messageId, role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // SDK's assistant event with same message ID - should be deduplicated
        {
          type: "assistant",
          timestamp: 350,
          message: { id: messageId, content: [{ type: "text", text: "Hello" }] },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have exactly 1 assistant event (the synthesized one)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
    })

    it("deduplicates in-progress streaming when assistant arrives with matching ID", () => {
      // Test deduplication when assistant arrives before message_stop but has matching ID
      const messageId = "msg_test456"
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { id: messageId, role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        // Assistant arrives BEFORE message_stop but with same ID
        {
          type: "assistant",
          timestamp: 250,
          message: { id: messageId, content: [{ type: "text", text: "Hello" }] },
        },
        {
          type: "stream_event",
          timestamp: 280,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have exactly 1 assistant event (the synthesized one from message_stop)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
    })

    it("handles multiple streaming messages correctly", () => {
      // Two complete streaming messages + their SDK assistant events
      const events: ChatEvent[] = [
        // First streaming message
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "First" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // SDK assistant for first message - should be deduplicated
        {
          type: "assistant",
          timestamp: 350,
          message: { content: [{ type: "text", text: "First" }] },
        },
        // Second streaming message
        {
          type: "stream_event",
          timestamp: 1500,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 1550,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 1600,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Second" },
          },
        },
        {
          type: "stream_event",
          timestamp: 1650,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 1700,
          event: { type: "message_stop" },
        },
        // SDK assistant for second message - should be deduplicated
        {
          type: "assistant",
          timestamp: 1750,
          message: { content: [{ type: "text", text: "Second" }] },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have exactly 2 assistant events (one synthesized from each streaming message)
      // SDK assistant events should be deduplicated
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(2)
    })

    it("does NOT deduplicate assistant events with different message IDs even if timestamps are close", () => {
      // This tests that ID-based matching takes priority: if both stream and assistant
      // have IDs but they differ, we should NOT deduplicate even if timestamps are close
      const streamMessageId = "msg_stream_001"
      const assistantMessageId = "msg_assistant_002" // Different ID!
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { id: streamMessageId, role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "First" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // Assistant with DIFFERENT ID but close timestamp - should NOT be deduplicated
        {
          type: "assistant",
          timestamp: 350, // Within 1000ms of message_stop
          message: {
            id: assistantMessageId,
            content: [{ type: "text", text: "Different message" }],
          },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have 2 assistant events because the IDs are different
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(2)
    })

    it("uses timestamp fallback only when message IDs are not available", () => {
      // Streaming without ID, assistant without ID, but close timestamps
      // This tests the timestamp fallback for legacy data
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } }, // No ID
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // Assistant without ID, close timestamp - should be deduplicated via fallback
        {
          type: "assistant",
          timestamp: 350, // Within 1000ms
          message: { content: [{ type: "text", text: "Hello" }] }, // No ID
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have 1 assistant event (deduplicated via timestamp fallback)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
    })

    it("does not use timestamp fallback when streaming has ID but assistant does not", () => {
      // If streaming has ID, we should only deduplicate by ID match
      // An assistant without ID should be treated as a different message
      const streamMessageId = "msg_stream_001"
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { id: streamMessageId, role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
        // Assistant WITHOUT ID, close timestamp
        // Since streaming has ID, we skip timestamp fallback for this range
        {
          type: "assistant",
          timestamp: 350,
          message: { content: [{ type: "text", text: "Hello" }] }, // No ID
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have 2 assistant events - the one without ID is not deduplicated
      // because the streaming range has an ID (so we expect ID-based matching)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(2)
    })
  })

  describe("immutable accumulation", () => {
    it("accumulates multiple text deltas into correct final text", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: ", " },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "world" },
          },
        },
        {
          type: "stream_event",
          timestamp: 230,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "!" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({ type: "text", text: "Hello, world!" })
    })

    it("accumulates multiple thinking deltas correctly", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "Let me " },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "think about " },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "this carefully." },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({
        type: "thinking",
        thinking: "Let me think about this carefully.",
      })
    })

    it("accumulates tool_use input_json_delta fragments into valid JSON", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "tool_1", name: "search" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: '{"query"' },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: ': "hello' },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: ' world"' },
          },
        },
        {
          type: "stream_event",
          timestamp: 230,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: ', "limit": 10}' },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({
        type: "tool_use",
        id: "tool_1",
        name: "search",
        input: { query: "hello world", limit: 10 },
      })
    })

    it("accumulates mixed content blocks (text, thinking, tool_use) correctly", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Thinking block
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 160,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "I need to " },
          },
        },
        {
          type: "stream_event",
          timestamp: 170,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "search for this." },
          },
        },
        {
          type: "stream_event",
          timestamp: 180,
          event: { type: "content_block_stop", index: 0 },
        },
        // Text block
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "text_delta", text: "Let me " },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "text_delta", text: "search that." },
          },
        },
        {
          type: "stream_event",
          timestamp: 230,
          event: { type: "content_block_stop", index: 1 },
        },
        // Tool use block
        {
          type: "stream_event",
          timestamp: 250,
          event: {
            type: "content_block_start",
            index: 2,
            content_block: { type: "tool_use", id: "tool_abc", name: "web_search" },
          },
        },
        {
          type: "stream_event",
          timestamp: 260,
          event: {
            type: "content_block_delta",
            index: 2,
            delta: { type: "input_json_delta", partial_json: '{"q":' },
          },
        },
        {
          type: "stream_event",
          timestamp: 270,
          event: {
            type: "content_block_delta",
            index: 2,
            delta: { type: "input_json_delta", partial_json: '"test"}' },
          },
        },
        {
          type: "stream_event",
          timestamp: 280,
          event: { type: "content_block_stop", index: 2 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(3)
      expect(content[0]).toEqual({
        type: "thinking",
        thinking: "I need to search for this.",
      })
      expect(content[1]).toEqual({
        type: "text",
        text: "Let me search that.",
      })
      expect(content[2]).toEqual({
        type: "tool_use",
        id: "tool_abc",
        name: "web_search",
        input: { q: "test" },
      })
    })

    it("provides correctly accumulated content blocks in streamingMessage before message_stop", () => {
      // Simulate in-progress streaming: no message_stop yet
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Streaming " },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "in " },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "progress" },
          },
        },
        // No content_block_stop or message_stop
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // No completed assistant events
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(0)

      // streamingMessage should have the accumulated content
      expect(result.current.streamingMessage).not.toBeNull()
      expect(result.current.streamingMessage!.timestamp).toBe(100)
      expect(result.current.streamingMessage!.contentBlocks).toHaveLength(1)
      expect(result.current.streamingMessage!.contentBlocks[0]).toEqual({
        type: "text",
        text: "Streaming in progress",
      })
    })

    it("does not corrupt accumulation when deltas contain empty strings", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 230,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 240,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: " World" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({ type: "text", text: "Hello World" })
    })
  })
})
