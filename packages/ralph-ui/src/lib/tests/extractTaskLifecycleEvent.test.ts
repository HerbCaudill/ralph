import { describe, it, expect } from "vitest"
import { extractTaskLifecycleEvent } from "../extractTaskLifecycleEvent"
import type { ChatEvent, AssistantChatEvent } from "@herbcaudill/agent-view"

describe("extractTaskLifecycleEvent", () => {
  it("returns null for non-assistant events", () => {
    const event: ChatEvent = {
      type: "user_message",
      message: "<start_task>r-abc123</start_task>",
      timestamp: Date.now(),
    }
    expect(extractTaskLifecycleEvent(event)).toBeNull()
  })

  it("returns null for assistant events without message content", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: Date.now(),
    }
    expect(extractTaskLifecycleEvent(event)).toBeNull()
  })

  it("returns null for assistant events without task markers", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: 1234567890,
      message: {
        content: [
          {
            type: "text",
            text: "Just a regular message",
          },
        ],
      },
    }
    expect(extractTaskLifecycleEvent(event)).toBeNull()
  })

  it("extracts starting task lifecycle from <start_task> marker", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: 1234567890,
      message: {
        content: [
          {
            type: "text",
            text: "<start_task>r-abc123</start_task>",
          },
        ],
      },
    }
    const result = extractTaskLifecycleEvent(event)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("task_lifecycle")
    expect(result?.action).toBe("starting")
    expect(result?.taskId).toBe("r-abc123")
    expect(result?.timestamp).toBe(1234567890)
  })

  it("extracts completed task lifecycle from <end_task> marker", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: 1234567890,
      message: {
        content: [
          {
            type: "text",
            text: "<end_task>r-abc123</end_task>",
          },
        ],
      },
    }
    const result = extractTaskLifecycleEvent(event)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("task_lifecycle")
    expect(result?.action).toBe("completed")
    expect(result?.taskId).toBe("r-abc123")
  })

  it("handles task ID with subtask notation", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: Date.now(),
      message: {
        content: [
          {
            type: "text",
            text: "<start_task>r-abc123.1</start_task>",
          },
        ],
      },
    }
    const result = extractTaskLifecycleEvent(event)
    expect(result?.taskId).toBe("r-abc123.1")
  })

  it("ignores thinking blocks", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: Date.now(),
      message: {
        content: [
          {
            type: "thinking" as any,
            thinking: "<start_task>r-abc123</start_task>",
          },
          {
            type: "text",
            text: "Regular text without markers",
          },
        ],
      },
    }
    expect(extractTaskLifecycleEvent(event)).toBeNull()
  })

  it("finds marker in any text block", () => {
    const event: AssistantChatEvent = {
      type: "assistant",
      timestamp: 1234567890,
      message: {
        content: [
          {
            type: "text",
            text: "First text block",
          },
          {
            type: "text",
            text: "<start_task>r-xyz789</start_task>",
          },
        ],
      },
    }
    const result = extractTaskLifecycleEvent(event)
    expect(result?.taskId).toBe("r-xyz789")
  })
})
