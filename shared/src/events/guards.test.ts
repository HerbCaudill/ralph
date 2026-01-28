import { describe, it, expect } from "vitest"
import {
  isAgentMessageEvent,
  isAgentThinkingEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "./guards.js"
import type {
  AgentEvent,
  AgentMessageEvent,
  AgentThinkingEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatusEvent,
} from "./types.js"

describe("Agent Event Type Guards", () => {
  const timestamp = Date.now()

  // Test fixtures
  const messageEvent: AgentMessageEvent = {
    type: "message",
    timestamp,
    content: "Hello, world!",
    isPartial: false,
  }

  const toolUseEvent: AgentToolUseEvent = {
    type: "tool_use",
    timestamp,
    toolUseId: "tool-1",
    tool: "Bash",
    input: { command: "ls" },
  }

  const toolResultEvent: AgentToolResultEvent = {
    type: "tool_result",
    timestamp,
    toolUseId: "tool-1",
    output: "file.txt",
    isError: false,
  }

  const resultEvent: AgentResultEvent = {
    type: "result",
    timestamp,
    content: "Task completed",
    usage: { inputTokens: 100, outputTokens: 50 },
  }

  const errorEvent: AgentErrorEvent = {
    type: "error",
    timestamp,
    message: "Something went wrong",
    code: "ERR_001",
    fatal: true,
  }

  const thinkingEvent: AgentThinkingEvent = {
    type: "thinking",
    timestamp,
    content: "Let me think about this...",
    isPartial: false,
  }

  const statusEvent: AgentStatusEvent = {
    type: "status",
    timestamp,
    status: "running",
  }

  const allEvents: AgentEvent[] = [
    messageEvent,
    thinkingEvent,
    toolUseEvent,
    toolResultEvent,
    resultEvent,
    errorEvent,
    statusEvent,
  ]

  describe("isAgentMessageEvent", () => {
    it("returns true for message events", () => {
      expect(isAgentMessageEvent(messageEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "message")) {
        expect(isAgentMessageEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = messageEvent
      if (isAgentMessageEvent(event)) {
        // TypeScript should know event.content exists
        expect(event.content).toBe("Hello, world!")
        expect(event.isPartial).toBe(false)
      }
    })
  })

  describe("isAgentThinkingEvent", () => {
    it("returns true for thinking events", () => {
      expect(isAgentThinkingEvent(thinkingEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "thinking")) {
        expect(isAgentThinkingEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = thinkingEvent
      if (isAgentThinkingEvent(event)) {
        expect(event.content).toBe("Let me think about this...")
        expect(event.isPartial).toBe(false)
      }
    })

    it("handles partial thinking events", () => {
      const partialThinking: AgentThinkingEvent = {
        type: "thinking",
        timestamp,
        content: "Partial thought...",
        isPartial: true,
      }
      expect(isAgentThinkingEvent(partialThinking)).toBe(true)
      if (isAgentThinkingEvent(partialThinking)) {
        expect(partialThinking.isPartial).toBe(true)
      }
    })
  })

  describe("isAgentToolUseEvent", () => {
    it("returns true for tool use events", () => {
      expect(isAgentToolUseEvent(toolUseEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "tool_use")) {
        expect(isAgentToolUseEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = toolUseEvent
      if (isAgentToolUseEvent(event)) {
        expect(event.toolUseId).toBe("tool-1")
        expect(event.tool).toBe("Bash")
        expect(event.input).toEqual({ command: "ls" })
      }
    })
  })

  describe("isAgentToolResultEvent", () => {
    it("returns true for tool result events", () => {
      expect(isAgentToolResultEvent(toolResultEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "tool_result")) {
        expect(isAgentToolResultEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = toolResultEvent
      if (isAgentToolResultEvent(event)) {
        expect(event.toolUseId).toBe("tool-1")
        expect(event.output).toBe("file.txt")
        expect(event.isError).toBe(false)
      }
    })

    it("handles error results", () => {
      const errorResult: AgentToolResultEvent = {
        type: "tool_result",
        timestamp,
        toolUseId: "tool-2",
        error: "Command failed",
        isError: true,
      }
      expect(isAgentToolResultEvent(errorResult)).toBe(true)
      if (isAgentToolResultEvent(errorResult)) {
        expect(errorResult.error).toBe("Command failed")
        expect(errorResult.isError).toBe(true)
      }
    })
  })

  describe("isAgentResultEvent", () => {
    it("returns true for result events", () => {
      expect(isAgentResultEvent(resultEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "result")) {
        expect(isAgentResultEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = resultEvent
      if (isAgentResultEvent(event)) {
        expect(event.content).toBe("Task completed")
        expect(event.usage?.inputTokens).toBe(100)
        expect(event.usage?.outputTokens).toBe(50)
      }
    })
  })

  describe("isAgentErrorEvent", () => {
    it("returns true for error events", () => {
      expect(isAgentErrorEvent(errorEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "error")) {
        expect(isAgentErrorEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = errorEvent
      if (isAgentErrorEvent(event)) {
        expect(event.message).toBe("Something went wrong")
        expect(event.code).toBe("ERR_001")
        expect(event.fatal).toBe(true)
      }
    })

    it("handles non-fatal errors", () => {
      const nonFatalError: AgentErrorEvent = {
        type: "error",
        timestamp,
        message: "Minor issue",
        fatal: false,
      }
      expect(isAgentErrorEvent(nonFatalError)).toBe(true)
      if (isAgentErrorEvent(nonFatalError)) {
        expect(nonFatalError.fatal).toBe(false)
      }
    })
  })

  describe("isAgentStatusEvent", () => {
    it("returns true for status events", () => {
      expect(isAgentStatusEvent(statusEvent)).toBe(true)
    })

    it("returns false for other event types", () => {
      for (const event of allEvents.filter(e => e.type !== "status")) {
        expect(isAgentStatusEvent(event)).toBe(false)
      }
    })

    it("narrows type correctly", () => {
      const event: AgentEvent = statusEvent
      if (isAgentStatusEvent(event)) {
        expect(event.status).toBe("running")
      }
    })

    it("handles all status values", () => {
      const statuses = ["idle", "starting", "running", "paused", "stopping", "stopped"] as const
      for (const status of statuses) {
        const event: AgentStatusEvent = { type: "status", timestamp, status }
        expect(isAgentStatusEvent(event)).toBe(true)
        if (isAgentStatusEvent(event)) {
          expect(event.status).toBe(status)
        }
      }
    })
  })

  describe("combined usage", () => {
    it("can switch on event types", () => {
      const processEvent = (event: AgentEvent): string => {
        if (isAgentMessageEvent(event)) {
          return `message: ${event.content}`
        }
        if (isAgentThinkingEvent(event)) {
          return `thinking: ${event.content}`
        }
        if (isAgentToolUseEvent(event)) {
          return `tool: ${event.tool}`
        }
        if (isAgentToolResultEvent(event)) {
          return `result: ${event.isError ? "error" : "success"}`
        }
        if (isAgentResultEvent(event)) {
          return `completed: ${event.content}`
        }
        if (isAgentErrorEvent(event)) {
          return `error: ${event.message}`
        }
        if (isAgentStatusEvent(event)) {
          return `status: ${event.status}`
        }
        return "unknown"
      }

      expect(processEvent(messageEvent)).toBe("message: Hello, world!")
      expect(processEvent(thinkingEvent)).toBe("thinking: Let me think about this...")
      expect(processEvent(toolUseEvent)).toBe("tool: Bash")
      expect(processEvent(toolResultEvent)).toBe("result: success")
      expect(processEvent(resultEvent)).toBe("completed: Task completed")
      expect(processEvent(errorEvent)).toBe("error: Something went wrong")
      expect(processEvent(statusEvent)).toBe("status: running")
    })
  })
})
