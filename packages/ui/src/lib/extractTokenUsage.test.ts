import { describe, it, expect } from "vitest"
import {
  extractTokenUsageFromEvent,
  aggregateTokenUsage,
  type RalphEvent,
} from "./extractTokenUsage"

describe("extractTokenUsage", () => {
  describe("extractTokenUsageFromEvent", () => {
    describe("stream_event with message_delta", () => {
      it("extracts basic token usage from message_delta", () => {
        const event: RalphEvent = {
          type: "stream_event",
          timestamp: 1234,
          event: {
            type: "message_delta",
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toEqual({ input: 100, output: 50 })
      })

      it("includes cache tokens in input count", () => {
        const event: RalphEvent = {
          type: "stream_event",
          timestamp: 1234,
          event: {
            type: "message_delta",
            usage: {
              input_tokens: 100,
              cache_creation_input_tokens: 500,
              cache_read_input_tokens: 200,
              output_tokens: 50,
            },
          },
        }

        const result = extractTokenUsageFromEvent(event)
        // 100 + 500 + 200 = 800 input tokens
        expect(result).toEqual({ input: 800, output: 50 })
      })

      it("handles missing cache tokens", () => {
        const event: RalphEvent = {
          type: "stream_event",
          timestamp: 1234,
          event: {
            type: "message_delta",
            usage: {
              output_tokens: 50,
            },
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toEqual({ input: 0, output: 50 })
      })

      it("returns null for message_delta without usage", () => {
        const event: RalphEvent = {
          type: "stream_event",
          timestamp: 1234,
          event: {
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })

      it("returns null for other stream_event types", () => {
        const event: RalphEvent = {
          type: "stream_event",
          timestamp: 1234,
          event: {
            type: "message_start",
            message: { id: "msg_123" },
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })

      it("returns null for zero usage", () => {
        const event: RalphEvent = {
          type: "stream_event",
          timestamp: 1234,
          event: {
            type: "message_delta",
            usage: {
              input_tokens: 0,
              output_tokens: 0,
            },
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })
    })

    describe("result events", () => {
      it("extracts usage from result with camelCase (ClaudeAdapter format)", () => {
        const event: RalphEvent = {
          type: "result",
          timestamp: 1234,
          content: "Task completed",
          usage: {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toEqual({ input: 1000, output: 500 })
      })

      it("extracts usage from result with snake_case (raw SDK format)", () => {
        const event: RalphEvent = {
          type: "result",
          timestamp: 1234,
          content: "Task completed",
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toEqual({ input: 1000, output: 500 })
      })

      it("prefers camelCase when both formats present", () => {
        const event: RalphEvent = {
          type: "result",
          timestamp: 1234,
          usage: {
            inputTokens: 1000,
            outputTokens: 500,
            input_tokens: 100, // Should be ignored
            output_tokens: 50, // Should be ignored
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toEqual({ input: 1000, output: 500 })
      })

      it("returns null for result without usage", () => {
        const event: RalphEvent = {
          type: "result",
          timestamp: 1234,
          content: "Task completed",
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })

      it("returns null for zero usage", () => {
        const event: RalphEvent = {
          type: "result",
          timestamp: 1234,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })
    })

    describe("other event types", () => {
      it("returns null for tool_use events", () => {
        const event: RalphEvent = {
          type: "tool_use",
          timestamp: 1234,
          tool: "read",
          input: { path: "/tmp/test" },
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })

      it("returns null for message events", () => {
        const event: RalphEvent = {
          type: "message",
          timestamp: 1234,
          content: "Hello, world!",
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })

      it("returns null for error events", () => {
        const event: RalphEvent = {
          type: "error",
          timestamp: 1234,
          message: "Something went wrong",
        }

        const result = extractTokenUsageFromEvent(event)
        expect(result).toBeNull()
      })
    })
  })

  describe("aggregateTokenUsage", () => {
    it("aggregates usage from multiple events", () => {
      const events: RalphEvent[] = [
        {
          type: "result",
          timestamp: 1000,
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          type: "result",
          timestamp: 2000,
          usage: { inputTokens: 200, outputTokens: 100 },
        },
        {
          type: "result",
          timestamp: 3000,
          usage: { inputTokens: 300, outputTokens: 150 },
        },
      ]

      const result = aggregateTokenUsage(events)
      expect(result).toEqual({ input: 600, output: 300 })
    })

    it("handles mixed event types", () => {
      const events: RalphEvent[] = [
        // stream_event with usage
        {
          type: "stream_event",
          timestamp: 1000,
          event: {
            type: "message_delta",
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        },
        // result with usage
        {
          type: "result",
          timestamp: 2000,
          usage: { inputTokens: 200, outputTokens: 100 },
        },
        // tool_use (no usage)
        {
          type: "tool_use",
          timestamp: 3000,
          tool: "read",
        },
      ]

      const result = aggregateTokenUsage(events)
      expect(result).toEqual({ input: 300, output: 150 })
    })

    it("returns zeros for empty array", () => {
      const result = aggregateTokenUsage([])
      expect(result).toEqual({ input: 0, output: 0 })
    })

    it("returns zeros when no events have usage", () => {
      const events: RalphEvent[] = [
        { type: "tool_use", timestamp: 1000, tool: "read" },
        { type: "message", timestamp: 2000, content: "Hello" },
      ]

      const result = aggregateTokenUsage(events)
      expect(result).toEqual({ input: 0, output: 0 })
    })

    it("handles events with partial usage data", () => {
      const events: RalphEvent[] = [
        {
          type: "result",
          timestamp: 1000,
          usage: { inputTokens: 100 }, // Missing outputTokens
        },
        {
          type: "stream_event",
          timestamp: 2000,
          event: {
            type: "message_delta",
            usage: { output_tokens: 50 }, // Missing input_tokens
          },
        },
      ]

      const result = aggregateTokenUsage(events)
      expect(result).toEqual({ input: 100, output: 50 })
    })
  })
})
