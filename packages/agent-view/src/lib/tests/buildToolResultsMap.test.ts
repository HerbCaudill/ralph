import { describe, it, expect } from "vitest"
import { buildToolResultsMap } from ".././buildToolResultsMap"
import type { ChatEvent } from "../../types"

describe("buildToolResultsMap", () => {
  describe("tool result extraction", () => {
    it("should extract tool results from user events", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "Success output",
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Success output",
        error: undefined,
      })
    })

    it("should extract multiple tool results", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "Output 1",
              },
              {
                type: "tool_result",
                tool_use_id: "tool-2",
                content: "Output 2",
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Output 1",
        error: undefined,
      })
      expect(result.toolResults.get("tool-2")).toEqual({
        output: "Output 2",
        error: undefined,
      })
    })

    it("should extract error results", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "Error message",
                is_error: true,
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      // When is_error is true, the function sets both output and error to the content
      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Error message",
        error: "Error message",
      })
    })

    it("should handle error with non-string content", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: { complex: "object" },
                is_error: true,
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: undefined,
        error: "Error",
      })
    })

    it("should skip tool results without tool_use_id", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                content: "Output without ID",
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.size).toBe(0)
    })

    it("should skip non-tool_result content items", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "text",
                text: "Some text",
              },
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "Output",
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.size).toBe(1)
      expect(result.toolResults.get("tool-1")).toBeDefined()
    })
  })

  describe("lifecycle event detection", () => {
    it("should detect ralph_task_started events", () => {
      const events: ChatEvent[] = [
        {
          type: "ralph_task_started",
          timestamp: 123,
          taskId: "r-abc",
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.hasStructuredLifecycleEvents).toBe(true)
    })

    it("should detect ralph_task_completed events", () => {
      const events: ChatEvent[] = [
        {
          type: "ralph_task_completed",
          timestamp: 123,
          taskId: "r-abc",
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.hasStructuredLifecycleEvents).toBe(true)
    })

    it("should detect both types of lifecycle events", () => {
      const events: ChatEvent[] = [
        {
          type: "ralph_task_started",
          timestamp: 123,
          taskId: "r-abc",
        },
        {
          type: "ralph_task_completed",
          timestamp: 456,
          taskId: "r-abc",
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.hasStructuredLifecycleEvents).toBe(true)
    })

    it("should return false when no lifecycle events present", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 123,
          message: { content: [] },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.hasStructuredLifecycleEvents).toBe(false)
    })
  })

  describe("combined processing", () => {
    it("should process tool results and lifecycle events together", () => {
      const events: ChatEvent[] = [
        {
          type: "ralph_task_started",
          timestamp: 100,
          taskId: "r-abc",
        },
        {
          type: "user",
          timestamp: 200,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "Output",
              },
            ],
          },
        },
        {
          type: "ralph_task_completed",
          timestamp: 300,
          taskId: "r-abc",
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.hasStructuredLifecycleEvents).toBe(true)
      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Output",
        error: undefined,
      })
    })
  })

  describe("standalone tool_result events", () => {
    it("should extract standalone tool_result from agent-server", () => {
      const events: ChatEvent[] = [
        {
          type: "tool_result",
          timestamp: 123,
          toolUseId: "tool-1",
          output: "Success output from agent-server",
        } as ChatEvent,
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Success output from agent-server",
        error: undefined,
      })
    })

    it("should extract error from standalone tool_result", () => {
      const events: ChatEvent[] = [
        {
          type: "tool_result",
          timestamp: 123,
          toolUseId: "tool-1",
          error: "Tool execution failed",
        } as ChatEvent,
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: undefined,
        error: "Tool execution failed",
      })
    })

    it("should handle both output and error in standalone tool_result", () => {
      const events: ChatEvent[] = [
        {
          type: "tool_result",
          timestamp: 123,
          toolUseId: "tool-1",
          output: "Partial output",
          error: "But also an error",
        } as ChatEvent,
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Partial output",
        error: "But also an error",
      })
    })

    it("should skip tool_result events without toolUseId", () => {
      const events: ChatEvent[] = [
        {
          type: "tool_result",
          timestamp: 123,
          output: "Output without ID",
        } as ChatEvent,
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.size).toBe(0)
    })

    it("should match standalone tool_result to corresponding tool_use", () => {
      // This test simulates the real flow where tool_use and tool_result
      // are separate events that need to be matched by toolUseId
      const events: ChatEvent[] = [
        {
          type: "tool_use",
          timestamp: 100,
          tool: "Read",
          toolUseId: "toolu_123",
          input: { file: "test.txt" },
        } as ChatEvent,
        {
          type: "tool_result",
          timestamp: 200,
          toolUseId: "toolu_123",
          output: "File contents here",
        } as ChatEvent,
      ]

      const result = buildToolResultsMap(events)

      // The tool_result should be extractable for the tool_use's toolUseId
      expect(result.toolResults.get("toolu_123")).toEqual({
        output: "File contents here",
        error: undefined,
      })
    })
  })

  describe("edge cases", () => {
    it("should handle empty events array", () => {
      const result = buildToolResultsMap([])

      expect(result.toolResults.size).toBe(0)
      expect(result.hasStructuredLifecycleEvents).toBe(false)
    })

    it("should handle events without message property", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.size).toBe(0)
    })

    it("should handle non-array content", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: "not an array" as any,
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.size).toBe(0)
    })

    it("should handle duplicate tool_use_ids by keeping last", () => {
      const events: ChatEvent[] = [
        {
          type: "user",
          timestamp: 123,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "First output",
              },
            ],
          },
        },
        {
          type: "user",
          timestamp: 456,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "Second output",
              },
            ],
          },
        },
      ]

      const result = buildToolResultsMap(events)

      expect(result.toolResults.get("tool-1")).toEqual({
        output: "Second output",
        error: undefined,
      })
    })
  })
})
