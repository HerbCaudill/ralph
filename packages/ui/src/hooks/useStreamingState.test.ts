import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStreamingState } from "@herbcaudill/agent-view"
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

    it("includes initial text from content_block_start in accumulated output", () => {
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
            content_block: { type: "text", text: "Prefix: " },
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
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content[0]).toEqual({ type: "text", text: "Prefix: Hello" })
    })

    it("handles tool_use with invalid JSON gracefully (returns empty object)", () => {
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
            delta: { type: "input_json_delta", partial_json: '{"incomplete' },
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
      expect(content[0]).toEqual({
        type: "tool_use",
        id: "tool_1",
        name: "search",
        input: {}, // Falls back to empty object for invalid JSON
      })
    })
  })

  describe("content block switching", () => {
    it("correctly handles switching from text to tool_use and back to text", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // First text block
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Let me search." },
          },
        },
        {
          type: "stream_event",
          timestamp: 130,
          event: { type: "content_block_stop", index: 0 },
        },
        // Tool use block
        {
          type: "stream_event",
          timestamp: 140,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "tool_use", id: "tool_1", name: "web_search" },
          },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "input_json_delta", partial_json: '{"q":"test"}' },
          },
        },
        {
          type: "stream_event",
          timestamp: 160,
          event: { type: "content_block_stop", index: 1 },
        },
        // Second text block (after tool)
        {
          type: "stream_event",
          timestamp: 170,
          event: {
            type: "content_block_start",
            index: 2,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 180,
          event: {
            type: "content_block_delta",
            index: 2,
            delta: { type: "text_delta", text: "Here are the results." },
          },
        },
        {
          type: "stream_event",
          timestamp: 190,
          event: { type: "content_block_stop", index: 2 },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(3)
      expect(content[0]).toEqual({ type: "text", text: "Let me search." })
      expect(content[1]).toEqual({
        type: "tool_use",
        id: "tool_1",
        name: "web_search",
        input: { q: "test" },
      })
      expect(content[2]).toEqual({ type: "text", text: "Here are the results." })
    })

    it("accumulates deltas only to the current block after switching", () => {
      // Ensures that after a content_block_start for block 1, deltas go to block 1
      // and don't affect block 0
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Block 0: text
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Block zero" },
          },
        },
        {
          type: "stream_event",
          timestamp: 130,
          event: { type: "content_block_stop", index: 0 },
        },
        // Block 1: text
        {
          type: "stream_event",
          timestamp: 140,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "text_delta", text: "Block one" },
          },
        },
        {
          type: "stream_event",
          timestamp: 160,
          event: { type: "content_block_stop", index: 1 },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(2)
      // Block 0 should only have its own content
      expect(content[0]).toEqual({ type: "text", text: "Block zero" })
      // Block 1 should only have its own content
      expect(content[1]).toEqual({ type: "text", text: "Block one" })
    })

    it("handles multiple tool_use blocks interleaved with text", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Text
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "First action:" },
          },
        },
        {
          type: "stream_event",
          timestamp: 130,
          event: { type: "content_block_stop", index: 0 },
        },
        // Tool 1
        {
          type: "stream_event",
          timestamp: 140,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "tool_use", id: "tool_a", name: "read_file" },
          },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "input_json_delta", partial_json: '{"path":"a.ts"}' },
          },
        },
        {
          type: "stream_event",
          timestamp: 160,
          event: { type: "content_block_stop", index: 1 },
        },
        // Tool 2
        {
          type: "stream_event",
          timestamp: 170,
          event: {
            type: "content_block_start",
            index: 2,
            content_block: { type: "tool_use", id: "tool_b", name: "read_file" },
          },
        },
        {
          type: "stream_event",
          timestamp: 180,
          event: {
            type: "content_block_delta",
            index: 2,
            delta: { type: "input_json_delta", partial_json: '{"path":"b.ts"}' },
          },
        },
        {
          type: "stream_event",
          timestamp: 190,
          event: { type: "content_block_stop", index: 2 },
        },
        // Final text
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_start",
            index: 3,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_delta",
            index: 3,
            delta: { type: "text_delta", text: "Done." },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: { type: "content_block_stop", index: 3 },
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
      expect(content).toHaveLength(4)
      expect(content[0]).toEqual({ type: "text", text: "First action:" })
      expect(content[1]).toEqual({
        type: "tool_use",
        id: "tool_a",
        name: "read_file",
        input: { path: "a.ts" },
      })
      expect(content[2]).toEqual({
        type: "tool_use",
        id: "tool_b",
        name: "read_file",
        input: { path: "b.ts" },
      })
      expect(content[3]).toEqual({ type: "text", text: "Done." })
    })
  })

  describe("message start/stop lifecycle", () => {
    it("produces no output for message_start followed immediately by message_stop (empty message)", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Empty message with no content blocks should not produce an assistant event
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(0)
      expect(result.current.streamingMessage).toBeNull()
    })

    it("preserves the timestamp from message_start on the synthesized assistant event", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 42000,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 42100,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 42200,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hi" },
          },
        },
        {
          type: "stream_event",
          timestamp: 42300,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 42500,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      expect(assistantEvents[0].timestamp).toBe(42000)
    })

    it("ignores message_delta events without breaking accumulation", () => {
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
        // message_delta with stop_reason and usage info
        {
          type: "stream_event",
          timestamp: 280,
          event: {
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
            usage: { output_tokens: 10 },
          },
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
      expect(content[0]).toEqual({ type: "text", text: "Hello" })
    })

    it("resets state between consecutive message_start events", () => {
      // Two complete messages back-to-back
      const events: ChatEvent[] = [
        // First message
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Message one" },
          },
        },
        {
          type: "stream_event",
          timestamp: 130,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 140,
          event: { type: "message_stop" },
        },
        // Second message
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Message two" },
          },
        },
        {
          type: "stream_event",
          timestamp: 230,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 240,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(2)
      expect((assistantEvents[0] as any).message.content[0].text).toBe("Message one")
      expect((assistantEvents[1] as any).message.content[0].text).toBe("Message two")
      // Second message should NOT contain content from first
      expect((assistantEvents[1] as any).message.content).toHaveLength(1)
    })

    it("passes through non-stream, non-assistant events unchanged", () => {
      const events: ChatEvent[] = [
        { type: "user", timestamp: 50, message: { content: "Hi" } },
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        { type: "tool_result", timestamp: 120, result: "some data" },
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
            delta: { type: "text_delta", text: "Hi" },
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

      // user and tool_result events should be in completedEvents
      expect(result.current.completedEvents.filter(e => e.type === "user")).toHaveLength(1)
      expect(result.current.completedEvents.filter(e => e.type === "tool_result")).toHaveLength(1)
      // Plus the synthesized assistant event
      expect(result.current.completedEvents.filter(e => e.type === "assistant")).toHaveLength(1)
    })
  })

  describe("incomplete streaming (no message_stop)", () => {
    it("returns streamingMessage with multiple content blocks when message is incomplete", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Thinking block (complete)
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "Thinking..." },
          },
        },
        {
          type: "stream_event",
          timestamp: 130,
          event: { type: "content_block_stop", index: 0 },
        },
        // Text block (in progress)
        {
          type: "stream_event",
          timestamp: 140,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "text_delta", text: "Partial response" },
          },
        },
        // No content_block_stop, no message_stop
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // No completed assistant events
      expect(result.current.completedEvents.filter(e => e.type === "assistant")).toHaveLength(0)

      // streamingMessage should have both blocks
      expect(result.current.streamingMessage).not.toBeNull()
      expect(result.current.streamingMessage!.contentBlocks).toHaveLength(2)
      expect(result.current.streamingMessage!.contentBlocks[0]).toEqual({
        type: "thinking",
        thinking: "Thinking...",
      })
      expect(result.current.streamingMessage!.contentBlocks[1]).toEqual({
        type: "text",
        text: "Partial response",
      })
    })

    it("returns streamingMessage with partial tool_use when interrupted", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "tool_1", name: "search" },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: '{"query":' },
          },
        },
        // No more events - stream interrupted mid-JSON
      ]

      const { result } = renderHook(() => useStreamingState(events))

      expect(result.current.completedEvents.filter(e => e.type === "assistant")).toHaveLength(0)

      expect(result.current.streamingMessage).not.toBeNull()
      expect(result.current.streamingMessage!.contentBlocks).toHaveLength(1)
      // Partial tool_use shows raw accumulated input (not parsed)
      expect(result.current.streamingMessage!.contentBlocks[0]).toEqual({
        type: "tool_use",
        id: "tool_1",
        name: "search",
        input: '{"query":',
      })
    })

    it("returns streamingMessage after message_start with no content blocks yet", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // message_start received, but no content_block_start yet
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have a streaming message with empty content blocks
      expect(result.current.streamingMessage).not.toBeNull()
      expect(result.current.streamingMessage!.timestamp).toBe(100)
      expect(result.current.streamingMessage!.contentBlocks).toHaveLength(0)
    })
  })

  describe("interleaved tool_use and text blocks", () => {
    it("handles thinking → text → tool → text → tool → text pattern", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Thinking
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 115,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "Planning steps..." },
          },
        },
        {
          type: "stream_event",
          timestamp: 120,
          event: { type: "content_block_stop", index: 0 },
        },
        // Text 1
        {
          type: "stream_event",
          timestamp: 130,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 135,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "text_delta", text: "I'll read the file." },
          },
        },
        {
          type: "stream_event",
          timestamp: 140,
          event: { type: "content_block_stop", index: 1 },
        },
        // Tool 1
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_start",
            index: 2,
            content_block: { type: "tool_use", id: "t1", name: "read_file" },
          },
        },
        {
          type: "stream_event",
          timestamp: 155,
          event: {
            type: "content_block_delta",
            index: 2,
            delta: { type: "input_json_delta", partial_json: '{"path":"src/index.ts"}' },
          },
        },
        {
          type: "stream_event",
          timestamp: 160,
          event: { type: "content_block_stop", index: 2 },
        },
        // Text 2
        {
          type: "stream_event",
          timestamp: 170,
          event: {
            type: "content_block_start",
            index: 3,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 175,
          event: {
            type: "content_block_delta",
            index: 3,
            delta: { type: "text_delta", text: "Now I'll write." },
          },
        },
        {
          type: "stream_event",
          timestamp: 180,
          event: { type: "content_block_stop", index: 3 },
        },
        // Tool 2
        {
          type: "stream_event",
          timestamp: 190,
          event: {
            type: "content_block_start",
            index: 4,
            content_block: { type: "tool_use", id: "t2", name: "write_file" },
          },
        },
        {
          type: "stream_event",
          timestamp: 195,
          event: {
            type: "content_block_delta",
            index: 4,
            delta: {
              type: "input_json_delta",
              partial_json: '{"path":"out.ts","content":"done"}',
            },
          },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "content_block_stop", index: 4 },
        },
        // Final text
        {
          type: "stream_event",
          timestamp: 210,
          event: {
            type: "content_block_start",
            index: 5,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 215,
          event: {
            type: "content_block_delta",
            index: 5,
            delta: { type: "text_delta", text: "All done!" },
          },
        },
        {
          type: "stream_event",
          timestamp: 220,
          event: { type: "content_block_stop", index: 5 },
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
      expect(content).toHaveLength(6)
      expect(content[0]).toEqual({ type: "thinking", thinking: "Planning steps..." })
      expect(content[1]).toEqual({ type: "text", text: "I'll read the file." })
      expect(content[2]).toEqual({
        type: "tool_use",
        id: "t1",
        name: "read_file",
        input: { path: "src/index.ts" },
      })
      expect(content[3]).toEqual({ type: "text", text: "Now I'll write." })
      expect(content[4]).toEqual({
        type: "tool_use",
        id: "t2",
        name: "write_file",
        input: { path: "out.ts", content: "done" },
      })
      expect(content[5]).toEqual({ type: "text", text: "All done!" })
    })

    it("handles rapid delta accumulation across many small fragments for interleaved blocks", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Text block with many small deltas
        {
          type: "stream_event",
          timestamp: 110,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        ...["H", "e", "l", "l", "o"].map((char, i) => ({
          type: "stream_event" as const,
          timestamp: 120 + i,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: char },
          },
        })),
        {
          type: "stream_event",
          timestamp: 130,
          event: { type: "content_block_stop", index: 0 },
        },
        // Tool block with many JSON fragments
        {
          type: "stream_event",
          timestamp: 140,
          event: {
            type: "content_block_start",
            index: 1,
            content_block: { type: "tool_use", id: "t1", name: "fn" },
          },
        },
        ...["{", '"a"', ":", '"b"', "}"].map((frag, i) => ({
          type: "stream_event" as const,
          timestamp: 150 + i,
          event: {
            type: "content_block_delta",
            index: 1,
            delta: { type: "input_json_delta", partial_json: frag },
          },
        })),
        {
          type: "stream_event",
          timestamp: 160,
          event: { type: "content_block_stop", index: 1 },
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({ type: "text", text: "Hello" })
      expect(content[1]).toEqual({
        type: "tool_use",
        id: "t1",
        name: "fn",
        input: { a: "b" },
      })
    })
  })

  describe("edge cases", () => {
    it("returns empty completedEvents and null streamingMessage for empty event array", () => {
      const { result } = renderHook(() => useStreamingState([]))

      expect(result.current.completedEvents).toEqual([])
      expect(result.current.streamingMessage).toBeNull()
    })

    it("handles stream_event with missing event field gracefully", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          // No event field
        },
        {
          type: "stream_event",
          timestamp: 200,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "OK" },
          },
        },
        {
          type: "stream_event",
          timestamp: 350,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 400,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should still produce the valid message despite the malformed event
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      expect((assistantEvents[0] as any).message.content[0]).toEqual({
        type: "text",
        text: "OK",
      })
    })

    it("handles content_block_delta before any content_block_start gracefully", () => {
      const events: ChatEvent[] = [
        {
          type: "stream_event",
          timestamp: 100,
          event: { type: "message_start", message: { role: "assistant" } },
        },
        // Delta arrives before any block start (should be ignored)
        {
          type: "stream_event",
          timestamp: 150,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "orphan" },
          },
        },
        // Now a proper block
        {
          type: "stream_event",
          timestamp: 200,
          event: {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          },
        },
        {
          type: "stream_event",
          timestamp: 250,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Valid" },
          },
        },
        {
          type: "stream_event",
          timestamp: 300,
          event: { type: "content_block_stop", index: 0 },
        },
        {
          type: "stream_event",
          timestamp: 350,
          event: { type: "message_stop" },
        },
      ]

      const { result } = renderHook(() => useStreamingState(events))

      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(1)
      const content = (assistantEvents[0] as any).message.content
      // The orphan delta should not appear in output
      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({ type: "text", text: "Valid" })
    })
  })
})
