import { describe, it, expect } from "vitest"
import { createClaudeAdapter } from ".././createClaudeAdapter"
import type { AgentAdapter, ChatEvent } from "@herbcaudill/agent-view"

/**
 * Integration tests demonstrating how agent-view-claude connects to agent-view.
 *
 * These tests verify the full pipeline: native Claude SDK events → adapter → ChatEvent[]
 * suitable for passing to `<AgentView events={events} />`.
 */
describe("agent-view + agent-view-claude integration", () => {
  /** Create the adapter once — same as a consumer would. */
  const adapter: AgentAdapter = createClaudeAdapter()

  it("adapter satisfies the AgentAdapter interface", () => {
    expect(adapter.meta.name).toBe("claude")
    expect(adapter.meta.displayName).toBe("Claude")
    expect(typeof adapter.convertEvent).toBe("function")
    expect(typeof adapter.convertEvents).toBe("function")
  })

  it("converts a realistic Claude session into ChatEvents", () => {
    // Simulated stream of native Claude CLI JSON events
    const nativeEvents = [
      // 1. Assistant says it will read a file
      {
        type: "assistant",
        timestamp: 1000,
        message: {
          content: [
            { type: "text", text: "Let me read the file first." },
            {
              type: "tool_use",
              id: "toolu_read_1",
              name: "Read",
              input: { file_path: "/src/index.ts" },
            },
          ],
        },
      },

      // 2. Tool result comes back
      {
        type: "user",
        timestamp: 2000,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_read_1",
              content: 'export function hello() { return "world" }',
              is_error: false,
            },
          ],
        },
      },

      // 3. Assistant responds with a fix
      {
        type: "assistant",
        timestamp: 3000,
        message: {
          content: [{ type: "text", text: "I see the issue. Let me fix the function." }],
        },
      },

      // 4. Tool use: Bash
      {
        type: "tool_use",
        timestamp: 4000,
        tool: "Bash",
        input: { command: "pnpm test" },
        output: "✓ All tests passed",
        status: "success",
      },

      // 5. Error event
      {
        type: "error",
        timestamp: 5000,
        error: "Rate limit exceeded",
      },

      // 6. Result with token usage
      {
        type: "result",
        timestamp: 6000,
        usage: { input_tokens: 500, output_tokens: 200 },
      },
    ]

    const chatEvents = adapter.convertEvents(nativeEvents)

    // All native events should produce ChatEvents
    expect(chatEvents).toHaveLength(6)

    // Every ChatEvent has a type and timestamp
    for (const event of chatEvents) {
      expect(event.type).toBeDefined()
      expect(event.timestamp).toBeGreaterThan(0)
    }

    // Verify event types in order
    expect(chatEvents.map(e => e.type)).toEqual([
      "assistant",
      "user",
      "assistant",
      "tool_use",
      "error",
      "result",
    ])
  })

  it("converts streaming events for real-time display", () => {
    const streamEvents = [
      // Content block start
      {
        type: "stream_event",
        timestamp: 1000,
        event: {
          type: "content_block_start",
          content_block: { type: "text", text: "" },
        },
      },

      // Content block delta (streaming text)
      {
        type: "stream_event",
        timestamp: 1100,
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello " },
        },
      },

      // Another delta
      {
        type: "stream_event",
        timestamp: 1200,
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "world!" },
        },
      },

      // Content block stop
      {
        type: "stream_event",
        timestamp: 1300,
        event: { type: "content_block_stop" },
      },
    ]

    const chatEvents = adapter.convertEvents(streamEvents)

    expect(chatEvents).toHaveLength(4)
    expect(chatEvents.every(e => e.type === "stream_event")).toBe(true)
    expect(chatEvents.every(e => e.timestamp ?? 0 > 0)).toBe(true)
  })

  it("normalizes token usage to both camelCase and snake_case", () => {
    const resultEvent = {
      type: "result",
      timestamp: 1000,
      usage: { input_tokens: 1000, output_tokens: 250 },
    }

    const [event] = adapter.convertEvent(resultEvent)
    const usage = (event as any).usage

    // Both naming conventions are available
    expect(usage.inputTokens).toBe(1000)
    expect(usage.outputTokens).toBe(250)
    expect(usage.input_tokens).toBe(1000)
    expect(usage.output_tokens).toBe(250)
  })

  it("filters out unrecognized events gracefully", () => {
    const mixedEvents = [
      { type: "assistant", timestamp: 1000, message: { content: [{ type: "text", text: "Hi" }] } },
      { type: "completely_unknown", timestamp: 2000 },
      { type: "another_unknown", timestamp: 3000, data: {} },
      { type: "error", timestamp: 4000, error: "oops" },
    ]

    const chatEvents = adapter.convertEvents(mixedEvents)

    // Only recognized events survive
    expect(chatEvents).toHaveLength(2)
    expect(chatEvents[0].type).toBe("assistant")
    expect(chatEvents[1].type).toBe("error")
  })

  it("produces events compatible with ChatEvent interface", () => {
    const nativeEvent = {
      type: "assistant",
      timestamp: 1000,
      message: {
        content: [{ type: "text", text: "Hello" }],
      },
    }

    const [chatEvent] = adapter.convertEvent(nativeEvent)

    // ChatEvent requires type and timestamp
    const typed: ChatEvent = chatEvent
    expect(typed.type).toBe("assistant")
    expect(typed.timestamp).toBe(1000)
  })

  it("handles user messages injected during a session", () => {
    const events = [
      { type: "user_message", timestamp: 1000, message: "Please stop and fix tests first" },
      {
        type: "assistant",
        timestamp: 2000,
        message: { content: [{ type: "text", text: "Sure, running tests now." }] },
      },
    ]

    const chatEvents = adapter.convertEvents(events)

    expect(chatEvents).toHaveLength(2)
    expect(chatEvents[0].type).toBe("user_message")
    expect((chatEvents[0] as any).message).toBe("Please stop and fix tests first")
    expect(chatEvents[1].type).toBe("assistant")
  })

  it("handles Ralph lifecycle events", () => {
    const events = [
      { type: "ralph_session_start", timestamp: 1000, sessionId: "session-1" },
      { type: "ralph_task_started", timestamp: 2000, taskId: "r-abc123" },
      { type: "ralph_task_completed", timestamp: 3000, taskId: "r-abc123" },
      { type: "ralph_session_end", timestamp: 4000, sessionId: "session-1" },
    ]

    const chatEvents = adapter.convertEvents(events)

    expect(chatEvents).toHaveLength(4)
    expect(chatEvents.map(e => e.type)).toEqual([
      "ralph_session_start",
      "ralph_task_started",
      "ralph_task_completed",
      "ralph_session_end",
    ])
  })
})
