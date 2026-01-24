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

    it("deduplicates when streaming is still in progress", () => {
      // This scenario: SDK sends assistant event while streaming is ongoing (no message_stop yet)
      // The assistant event should be deduplicated to avoid showing both the streaming content
      // and the SDK assistant event simultaneously
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
        // SDK assistant arrives BEFORE message_stop - streaming is still in progress
        {
          type: "assistant",
          timestamp: 250,
          message: { content: [{ type: "text", text: "Hello World" }] },
        },
        // More streaming deltas
        {
          type: "stream_event",
          timestamp: 300,
          event: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: " World" },
          },
        },
        // Note: no message_stop yet - streaming is still in progress
      ]

      const { result } = renderHook(() => useStreamingState(events))

      // Should have 0 completed assistant events (the SDK one should be deduplicated)
      // AND we should have a streamingMessage (the in-progress one)
      const assistantEvents = result.current.completedEvents.filter(e => e.type === "assistant")
      expect(assistantEvents).toHaveLength(0)
      expect(result.current.streamingMessage).not.toBeNull()
      expect(result.current.streamingMessage?.contentBlocks[0]).toEqual({
        type: "text",
        text: "Hello World",
      })
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
  })
})
