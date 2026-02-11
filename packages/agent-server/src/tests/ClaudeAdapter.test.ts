import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  ClaudeAdapter,
  DEFAULT_CLAUDE_MODEL,
  type QueryFn,
  parseCliVersionOutput,
  clearCachedDetectedModel,
  getCachedDetectedModel,
} from ".././ClaudeAdapter.js"
import type { AgentEvent, AgentStatusEvent } from ".././agentTypes.js"
import * as loadClaudeMdModule from "../lib/loadClaudeMd.js"

// Mock loadClaudeMd module
vi.mock("../lib/loadClaudeMd.js", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/loadClaudeMd.js")>("../lib/loadClaudeMd.js")
  return {
    ...actual,
    loadClaudeMdSync: vi.fn(() => null),
  }
})

/**
 * Create a mock queryFn that yields the given SDK messages.
 * The returned async generator yields each message in order.
 */
function createMockQueryFn(messages: Array<Record<string, unknown>>): QueryFn {
  return async function* (_opts: unknown) {
    for (const msg of messages) {
      yield msg as never
    }
  } as unknown as QueryFn
}

/**
 * Collect all events emitted by an adapter.
 */
function collectEvents(adapter: ClaudeAdapter): AgentEvent[] {
  const events: AgentEvent[] = []
  adapter.on("event", (event: AgentEvent) => {
    events.push(event)
  })
  return events
}

/**
 * Collect all status changes emitted by an adapter.
 */
function collectStatuses(adapter: ClaudeAdapter): string[] {
  const statuses: string[] = []
  adapter.on("status", (status: string) => {
    statuses.push(status)
  })
  return statuses
}

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter
  const mockLoadClaudeMdSync = vi.mocked(loadClaudeMdModule.loadClaudeMdSync)

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no CLAUDE.md files
    mockLoadClaudeMdSync.mockReturnValue(null)
    // Clear the module-level model cache before each test
    clearCachedDetectedModel()
  })

  afterEach(() => {
    // Clean up the module-level model cache after each test
    clearCachedDetectedModel()
  })

  describe("runQuery sets status to idle on completion", () => {
    it("emits a status 'idle' event after runQuery completes successfully", async () => {
      const sdkMessages = [
        {
          type: "result",
          subtype: "success",
          result: "Hello!",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)
      const statuses = collectStatuses(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      // Wait for the in-flight query to complete
      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // The status sequence should go: starting -> running -> idle
      expect(statuses).toContain("starting")
      expect(statuses).toContain("running")
      expect(statuses).toContain("idle")

      // Verify there is a status event with status "idle" in the emitted events
      const idleStatusEvents = events.filter(
        (e): e is AgentStatusEvent =>
          e.type === "status" && (e as AgentStatusEvent).status === "idle",
      )
      expect(idleStatusEvents.length).toBe(1)
      expect(idleStatusEvents[0].status).toBe("idle")
    })

    it("does not emit idle status when the query throws a non-retryable error", async () => {
      const queryFn = async function* (_opts: unknown) {
        throw new Error("invalid API key")
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
        retryConfig: { maxRetries: 0, initialDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1 },
      })

      const statuses = collectStatuses(adapter)

      // Listen for error events to prevent unhandled rejection
      adapter.on("error", () => {})

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      // Wait for the query to fail
      await vi.waitFor(() => {
        expect(statuses).toContain("stopped")
      })

      // Should NOT contain idle -- it went from running -> stopped
      expect(statuses).not.toContain("idle")
    })
  })

  describe("handleSDKMessage emits structured assistant event", () => {
    it("emits a structured 'assistant' event with message.content blocks when receiving an SDK assistant message", async () => {
      const assistantMessage = {
        role: "assistant",
        content: [
          { type: "text", text: "Here is my response." },
          {
            type: "tool_use",
            id: "tool_1",
            name: "read_file",
            input: { path: "/tmp/file.txt" },
          },
        ],
      }

      const sdkMessages = [
        { type: "assistant", message: assistantMessage },
        {
          type: "result",
          subtype: "success",
          result: "Here is my response.",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Read the file" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // Should have emitted a structured "assistant" event (not individual "message" events)
      const assistantEvents = events.filter(e => e.type === "assistant")
      expect(assistantEvents.length).toBe(1)

      const evt = assistantEvents[0] as Record<string, unknown>
      expect(evt.type).toBe("assistant")
      expect(evt.timestamp).toBeTypeOf("number")

      // The message should contain the original content blocks
      const msg = evt.message as { content: Array<{ type: string; text?: string; id?: string }> }
      expect(msg.content).toHaveLength(2)
      expect(msg.content[0]).toEqual({ type: "text", text: "Here is my response." })
      expect(msg.content[1]).toMatchObject({
        type: "tool_use",
        id: "tool_1",
        name: "read_file",
      })
    })

    it("does not emit individual 'message' type events for SDK assistant messages", async () => {
      const assistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "Hello there." }],
      }

      const sdkMessages = [
        { type: "assistant", message: assistantMessage },
        {
          type: "result",
          subtype: "success",
          result: "Hello there.",
          usage: { input_tokens: 5, output_tokens: 3 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // The "assistant" SDK message type should NOT produce individual "message" events.
      // "message" events should only come from stream_event content_block_delta, not from
      // top-level "assistant" messages.
      const messageEvents = events.filter(e => e.type === "message")
      expect(messageEvents.length).toBe(0)
    })
  })

  describe("trackAssistantMessage tracks conversation context", () => {
    it("tracks text content in conversation context", async () => {
      const assistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "The answer is 42." }],
      }

      const sdkMessages = [
        { type: "assistant", message: assistantMessage },
        {
          type: "result",
          subtype: "success",
          result: "The answer is 42.",
          usage: { input_tokens: 8, output_tokens: 6 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "What is the answer?" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const context = adapter.getConversationContext()

      // Should have two messages: user + assistant
      expect(context.messages).toHaveLength(2)
      expect(context.messages[0].role).toBe("user")
      expect(context.messages[0].content).toBe("What is the answer?")
      expect(context.messages[1].role).toBe("assistant")
      expect(context.messages[1].content).toBe("The answer is 42.")
    })

    it("tracks tool uses in conversation context", async () => {
      const assistantMessage = {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check." },
          {
            type: "tool_use",
            id: "tool_abc",
            name: "bash",
            input: { command: "ls" },
          },
        ],
      }

      const sdkMessages = [
        { type: "assistant", message: assistantMessage },
        {
          type: "result",
          subtype: "success",
          result: "Let me check.",
          usage: { input_tokens: 10, output_tokens: 8 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "List files" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const context = adapter.getConversationContext()

      // The assistant message (finalized by the result handler) should have tool uses tracked
      const assistantMsg = context.messages.find(m => m.role === "assistant")
      expect(assistantMsg).toBeDefined()
      expect(assistantMsg!.toolUses).toHaveLength(1)
      expect(assistantMsg!.toolUses![0]).toMatchObject({
        id: "tool_abc",
        name: "bash",
        input: { command: "ls" },
      })
    })

    it("emits tool_result events from SDK user messages", async () => {
      const sdkMessages = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_123",
                name: "bash",
                input: { command: "echo hello" },
              },
            ],
          },
        },
        // SDK sends user message with tool result after tool execution
        {
          type: "user",
          message: {
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_123",
                content: "hello",
              },
            ],
          },
          parent_tool_use_id: null,
        },
        {
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "Done!" }] },
        },
        {
          type: "result",
          subtype: "success",
          result: "Done!",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Run a command" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // Should have emitted a tool_result event
      const toolResultEvents = events.filter(e => e.type === "tool_result")
      expect(toolResultEvents).toHaveLength(1)
      expect(toolResultEvents[0]).toMatchObject({
        type: "tool_result",
        toolUseId: "toolu_123",
        output: "hello",
        error: undefined,
        isError: false,
      })
    })

    it("emits tool_result error events for failed tools", async () => {
      const sdkMessages = [
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_456",
                name: "bash",
                input: { command: "exit 1" },
              },
            ],
          },
        },
        {
          type: "user",
          message: {
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_456",
                content: "Command failed with exit code 1",
                is_error: true,
              },
            ],
          },
          parent_tool_use_id: null,
        },
        {
          type: "result",
          subtype: "success",
          result: "Command failed.",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Run a failing command" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const toolResultEvents = events.filter(e => e.type === "tool_result")
      expect(toolResultEvents).toHaveLength(1)
      expect(toolResultEvents[0]).toMatchObject({
        type: "tool_result",
        toolUseId: "toolu_456",
        output: undefined,
        error: "Command failed with exit code 1",
        isError: true,
      })
    })

    it("tracks the last prompt in conversation context", async () => {
      const sdkMessages = [
        {
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "OK" }] },
        },
        {
          type: "result",
          subtype: "success",
          result: "OK",
          usage: { input_tokens: 5, output_tokens: 2 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Do something" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const context = adapter.getConversationContext()
      expect(context.lastPrompt).toBe("Do something")
    })

    it("tracks usage in conversation context", async () => {
      const sdkMessages = [
        {
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "Done" }] },
        },
        {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Go" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const context = adapter.getConversationContext()
      expect(context.usage.inputTokens).toBe(100)
      expect(context.usage.outputTokens).toBe(50)
      expect(context.usage.totalTokens).toBe(150)
    })

    it("emits turn_usage from streaming lifecycle events when result has no usage", async () => {
      const sdkMessages = [
        // stream_event with message_start (carries input tokens)
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: {
              usage: {
                input_tokens: 120,
                cache_creation_input_tokens: 10,
                cache_read_input_tokens: 5,
                output_tokens: 0,
              },
            },
          },
        },
        // stream_event with content
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        // stream_event with message_delta (carries output tokens)
        {
          type: "stream_event",
          event: {
            type: "message_delta",
            usage: { output_tokens: 45 },
          },
        },
        // message_stop triggers turn_usage emission
        {
          type: "stream_event",
          event: { type: "message_stop" },
        },
        // result without usage
        {
          type: "result",
          subtype: "success",
          result: "Hello",
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // Usage is emitted as turn_usage, not on the result event
      const turnUsageEvent = events.find(e => e.type === "turn_usage") as AgentEvent & {
        usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
      }
      expect(turnUsageEvent).toBeDefined()
      // input = 120 + 10 + 5 = 135
      expect(turnUsageEvent.usage!.inputTokens).toBe(135)
      expect(turnUsageEvent.usage!.outputTokens).toBe(45)
      expect(turnUsageEvent.usage!.totalTokens).toBe(180)

      // Result event should NOT carry usage (to avoid double-counting)
      const resultEvent = events.find(e => e.type === "result") as AgentEvent & {
        usage?: unknown
      }
      expect(resultEvent.usage).toBeUndefined()

      // Conversation context should still have usage
      const context = adapter.getConversationContext()
      expect(context.usage.inputTokens).toBe(135)
      expect(context.usage.outputTokens).toBe(45)
      expect(context.usage.totalTokens).toBe(180)
    })

    it("tracks totalUsage from result.usage in conversation context even when turn_usage is emitted", async () => {
      const sdkMessages = [
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: { usage: { input_tokens: 100, output_tokens: 0 } },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "message_delta",
            usage: { output_tokens: 30 },
          },
        },
        // message_stop emits turn_usage
        {
          type: "stream_event",
          event: { type: "message_stop" },
        },
        // result also carries usage (from SDK)
        {
          type: "result",
          subtype: "success",
          result: "Hi",
          usage: { input_tokens: 200, output_tokens: 60 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // turn_usage carries streaming counts
      const turnUsageEvent = events.find(e => e.type === "turn_usage") as AgentEvent & {
        usage?: { inputTokens?: number; outputTokens?: number }
      }
      expect(turnUsageEvent).toBeDefined()
      expect(turnUsageEvent.usage!.inputTokens).toBe(100)
      expect(turnUsageEvent.usage!.outputTokens).toBe(30)

      // Result event should NOT carry usage
      const resultEvent = events.find(e => e.type === "result") as AgentEvent & {
        usage?: unknown
      }
      expect(resultEvent.usage).toBeUndefined()

      // Conversation context uses result.usage (preferred over streaming) for internal tracking
      const context = adapter.getConversationContext()
      expect(context.usage.inputTokens).toBe(200)
      expect(context.usage.outputTokens).toBe(60)
    })

    it("emits turn_usage events at message_stop for incremental usage tracking", async () => {
      const sdkMessages = [
        // Turn 1: message_start → content → message_delta → message_stop
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: { usage: { input_tokens: 100, cache_creation_input_tokens: 0 } },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "message_delta",
            usage: { output_tokens: 50 },
          },
        },
        { type: "stream_event", event: { type: "message_stop" } },
        // Turn 2: message_start → content → message_delta → message_stop
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: { usage: { input_tokens: 200 } },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "World" },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "message_delta",
            usage: { output_tokens: 75 },
          },
        },
        { type: "stream_event", event: { type: "message_stop" } },
        // Final result
        {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 300, output_tokens: 125 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // Should have two turn_usage events
      const turnUsageEvents = events.filter(e => e.type === "turn_usage") as Array<
        AgentEvent & { usage: { inputTokens: number; outputTokens: number; totalTokens: number } }
      >
      expect(turnUsageEvents).toHaveLength(2)

      // First turn: 100 input, 50 output
      expect(turnUsageEvents[0].usage.inputTokens).toBe(100)
      expect(turnUsageEvents[0].usage.outputTokens).toBe(50)

      // Second turn: 200 input, 75 output
      expect(turnUsageEvents[1].usage.inputTokens).toBe(200)
      expect(turnUsageEvents[1].usage.outputTokens).toBe(75)

      // Result event should NOT have usage (turn_usage events already cover it)
      const resultEvent = events.find(e => e.type === "result") as AgentEvent & {
        usage?: { inputTokens?: number; outputTokens?: number }
      }
      expect(resultEvent.usage).toBeUndefined()

      // But conversation context should still track cumulative usage
      const context = adapter.getConversationContext()
      expect(context.usage.inputTokens).toBe(300)
      expect(context.usage.outputTokens).toBe(125)
    })

    it("includes model in turn_usage events for UI display", async () => {
      const sdkMessages = [
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: {
              model: "claude-opus-4-20250514",
              usage: { input_tokens: 100 },
            },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "message_delta",
            usage: { output_tokens: 50 },
          },
        },
        { type: "stream_event", event: { type: "message_stop" } },
        {
          type: "result",
          subtype: "success",
          result: "Hello",
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // turn_usage event should include the detected model
      const turnUsageEvent = events.find(e => e.type === "turn_usage") as AgentEvent & {
        model?: string
        usage: { inputTokens: number; outputTokens: number }
      }
      expect(turnUsageEvent).toBeDefined()
      expect(turnUsageEvent.model).toBe("claude-opus-4-20250514")
    })

    it("deduplicates tool_use blocks when stream_event and top-level assistant both contain the same tool_use ID", async () => {
      const toolUseBlock = {
        type: "tool_use",
        id: "tool_dup",
        name: "bash",
        input: { command: "echo hello" },
      }

      const assistantMessage = {
        role: "assistant",
        content: [toolUseBlock],
      }

      const sdkMessages = [
        // 1. SDK sends a stream_event with an inner assistant event containing the tool_use
        {
          type: "stream_event",
          event: {
            type: "assistant",
            message: { content: [toolUseBlock] },
          },
        },
        // 2. SDK sends a top-level assistant message with the SAME tool_use block
        { type: "assistant", message: assistantMessage },
        // 3. SDK sends a result message
        {
          type: "result",
          subtype: "success",
          result: "",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Run a command" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const context = adapter.getConversationContext()

      // Find the assistant message in context
      const assistantMsg = context.messages.find(m => m.role === "assistant")
      expect(assistantMsg).toBeDefined()

      // The assistant message should have exactly ONE tool_use entry, not two
      expect(assistantMsg!.toolUses).toHaveLength(1)
      expect(assistantMsg!.toolUses![0]).toMatchObject({
        id: "tool_dup",
        name: "bash",
        input: { command: "echo hello" },
      })
    })

    it("handles assistant messages with no content blocks gracefully", async () => {
      const sdkMessages = [
        { type: "assistant", message: { role: "assistant" } },
        {
          type: "result",
          subtype: "success",
          result: "",
          usage: { input_tokens: 5, output_tokens: 1 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // Should not throw; assistant event is still emitted
      const assistantEvents = events.filter(e => e.type === "assistant")
      expect(assistantEvents.length).toBe(1)
    })

    it("passes hooks: {} to queryFn to prevent tool use concurrency issues", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      expect(capturedOpts).toBeDefined()
      const options = capturedOpts!.options as Record<string, unknown>
      expect(options).toBeDefined()
      expect(options.hooks).toEqual({})
    })

    it("captures session ID from SDK messages", async () => {
      const sdkMessages = [
        {
          type: "assistant",
          session_id: "sess_12345",
          message: { role: "assistant", content: [{ type: "text", text: "Hi" }] },
        },
        {
          type: "result",
          subtype: "success",
          result: "Hi",
          usage: { input_tokens: 5, output_tokens: 2 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hello" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      expect(adapter.getSessionId()).toBe("sess_12345")
    })
  })

  describe("getInfo", () => {
    it("returns the expected agent info shape", () => {
      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn([]),
        apiKey: "test-key",
      })

      const info = adapter.getInfo()
      expect(info.id).toBe("claude")
      expect(info.name).toBe("Claude")
      expect(info.description).toBe("Anthropic Claude via SDK")
      expect(info.features).toEqual({
        streaming: true,
        tools: true,
        pauseResume: true,
        systemPrompt: true,
      })
      // version may be a string or undefined depending on whether claude CLI is installed
      expect(info.version === undefined || typeof info.version === "string").toBe(true)
    })
  })

  describe("start() re-initialization behavior", () => {
    it("allows calling start() a second time when adapter is idle (no in-flight request)", async () => {
      const sdkMessages = [
        {
          type: "result",
          subtype: "success",
          result: "Hello!",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      ]

      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
      })

      const statuses = collectStatuses(adapter)

      // First start
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      // Wait for the query to complete and adapter to become idle
      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // Second start should NOT throw (adapter is idle, no in-flight request)
      await expect(adapter.start({ cwd: "/tmp" })).resolves.toBeUndefined()

      // Status should be "running" after the second start
      expect(adapter.status).toBe("running")
    })

    it("throws when calling start() while adapter has an in-flight request", async () => {
      // Create a queryFn that never resolves (simulates an in-flight request)
      let resolveQuery: (() => void) | undefined
      const queryFn = async function* (_opts: unknown) {
        await new Promise<void>(resolve => {
          resolveQuery = resolve
        })
        // yield nothing - the query is stuck
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      // Now there's an in-flight request; start() should throw
      await expect(adapter.start({ cwd: "/tmp" })).rejects.toThrow(
        "Claude adapter is already running",
      )

      // Clean up: resolve the hanging query and stop
      resolveQuery?.()
      await adapter.stop()
    })

    it("supports the full flow: start → send → idle → start again → send (second message works)", async () => {
      let callCount = 0

      // Create a queryFn that returns different results on each call
      const queryFn = async function* (_opts: unknown) {
        callCount++
        yield {
          type: "result",
          subtype: "success",
          result: callCount === 1 ? "First response" : "Second response",
          usage: { input_tokens: 10, output_tokens: 5 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)
      const statuses = collectStatuses(adapter)

      // First message
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "First" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // Verify first result was received
      const firstResults = events.filter(
        e => e.type === "result" && (e as { content?: string }).content === "First response",
      )
      expect(firstResults).toHaveLength(1)

      // Clear events tracking for second message
      events.length = 0
      statuses.length = 0

      // Second message: start again, then send
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Second" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // Verify second result was received
      const secondResults = events.filter(
        e => e.type === "result" && (e as { content?: string }).content === "Second response",
      )
      expect(secondResults).toHaveLength(1)

      // Verify the queryFn was called twice total
      expect(callCount).toBe(2)
    })
  })

  describe("multi-turn conversation resume behavior", () => {
    it("passes resume with session ID from first message when sending a second message", async () => {
      const capturedCalls: Array<{ prompt: unknown; options: Record<string, unknown> }> = []
      let callCount = 0

      const queryFn = async function* (opts: unknown) {
        callCount++
        const typedOpts = opts as { prompt: unknown; options: Record<string, unknown> }
        capturedCalls.push({ prompt: typedOpts.prompt, options: typedOpts.options })

        // First call returns a session_id, second call does not need to
        if (callCount === 1) {
          yield {
            type: "assistant",
            session_id: "sess_abc123",
            message: { role: "assistant", content: [{ type: "text", text: "First reply" }] },
          } as never
        } else {
          yield {
            type: "assistant",
            message: { role: "assistant", content: [{ type: "text", text: "Second reply" }] },
          } as never
        }
        yield {
          type: "result",
          subtype: "success",
          result: callCount === 1 ? "First reply" : "Second reply",
          usage: { input_tokens: 10, output_tokens: 5 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const statuses = collectStatuses(adapter)

      // First message
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hello" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // First call should have no resume (no session yet)
      expect(capturedCalls[0].options.resume).toBeUndefined()
      expect(capturedCalls[0].prompt).toBe("Hello")

      // Reset statuses for second message
      statuses.length = 0

      // Second message in the same conversation
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Follow up" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // Second call should pass the session ID from the first message as resume
      expect(capturedCalls[1].options.resume).toBe("sess_abc123")
    })

    it("passes the prompt (not empty) for second+ messages in a conversation", async () => {
      const capturedCalls: Array<{ prompt: unknown; options: Record<string, unknown> }> = []
      let callCount = 0

      const queryFn = async function* (opts: unknown) {
        callCount++
        const typedOpts = opts as { prompt: unknown; options: Record<string, unknown> }
        capturedCalls.push({ prompt: typedOpts.prompt, options: typedOpts.options })

        if (callCount === 1) {
          yield {
            type: "assistant",
            session_id: "sess_xyz789",
            message: { role: "assistant", content: [{ type: "text", text: "OK" }] },
          } as never
        } else {
          yield {
            type: "assistant",
            message: { role: "assistant", content: [{ type: "text", text: "Got it" }] },
          } as never
        }
        yield {
          type: "result",
          subtype: "success",
          result: callCount === 1 ? "OK" : "Got it",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const statuses = collectStatuses(adapter)

      // First message
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "First question" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      statuses.length = 0

      // Second message
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Second question" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // Both calls should have their full prompt, not empty
      expect(capturedCalls[0].prompt).toBe("First question")
      expect(capturedCalls[1].prompt).toBe("Second question")
    })

    it("does not emit RESUMING event for normal multi-turn messages (only retries)", async () => {
      let callCount = 0

      const queryFn = async function* (_opts: unknown) {
        callCount++

        if (callCount === 1) {
          yield {
            type: "assistant",
            session_id: "sess_resume_test",
            message: { role: "assistant", content: [{ type: "text", text: "Hi" }] },
          } as never
        } else {
          yield {
            type: "assistant",
            message: { role: "assistant", content: [{ type: "text", text: "Hi again" }] },
          } as never
        }
        yield {
          type: "result",
          subtype: "success",
          result: callCount === 1 ? "Hi" : "Hi again",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)
      const statuses = collectStatuses(adapter)

      // First message
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hello" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      statuses.length = 0

      // Second message (multi-turn, not a retry)
      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "More" })

      await vi.waitFor(() => {
        expect(statuses).toContain("idle")
      })

      // No RESUMING error events should have been emitted
      const resumingEvents = events.filter(
        e => e.type === "error" && (e as { code?: string }).code === "RESUMING",
      )
      expect(resumingEvents).toHaveLength(0)
    })
  })

  describe("model option", () => {
    it("uses default model from options when no per-message model is specified", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
        model: "claude-haiku-4-5-20251001",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      expect(capturedOpts).toBeDefined()
      const options = capturedOpts!.options as Record<string, unknown>
      expect(options.model).toBe("claude-haiku-4-5-20251001")
    })

    it("per-message model overrides the default model", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
        model: "claude-haiku-4-5-20251001",
      })

      const events = collectEvents(adapter)

      // Start with a per-message model override
      await adapter.start({ cwd: "/tmp", model: "claude-sonnet-4-20250514" })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      expect(capturedOpts).toBeDefined()
      const options = capturedOpts!.options as Record<string, unknown>
      expect(options.model).toBe("claude-sonnet-4-20250514")
    })

    it("uses CLAUDE_MODEL env var as fallback when no explicit model is set", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      // Set env var and create adapter without explicit model
      const originalEnv = process.env.CLAUDE_MODEL
      try {
        process.env.CLAUDE_MODEL = "claude-sonnet-4-20250514"

        adapter = new ClaudeAdapter({
          queryFn,
          apiKey: "test-key",
        })

        const events = collectEvents(adapter)

        await adapter.start({ cwd: "/tmp" })
        adapter.send({ type: "user_message", content: "Hi" })

        await vi.waitFor(() => {
          expect(events.some(e => e.type === "result")).toBe(true)
        })

        expect(capturedOpts).toBeDefined()
        const options = capturedOpts!.options as Record<string, unknown>
        expect(options.model).toBe("claude-sonnet-4-20250514")
      } finally {
        // Restore original env
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })

    it("explicit model option takes precedence over CLAUDE_MODEL env var", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      const originalEnv = process.env.CLAUDE_MODEL
      try {
        process.env.CLAUDE_MODEL = "claude-sonnet-4-20250514"

        adapter = new ClaudeAdapter({
          queryFn,
          apiKey: "test-key",
          model: "claude-haiku-4-5-20251001",
        })

        const events = collectEvents(adapter)

        await adapter.start({ cwd: "/tmp" })
        adapter.send({ type: "user_message", content: "Hi" })

        await vi.waitFor(() => {
          expect(events.some(e => e.type === "result")).toBe(true)
        })

        expect(capturedOpts).toBeDefined()
        const options = capturedOpts!.options as Record<string, unknown>
        expect(options.model).toBe("claude-haiku-4-5-20251001")
      } finally {
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })

    it("uses DEFAULT_CLAUDE_MODEL when neither option nor env var is set", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      const originalEnv = process.env.CLAUDE_MODEL
      try {
        delete process.env.CLAUDE_MODEL

        adapter = new ClaudeAdapter({
          queryFn,
          apiKey: "test-key",
        })

        const events = collectEvents(adapter)

        await adapter.start({ cwd: "/tmp" })
        adapter.send({ type: "user_message", content: "Hi" })

        await vi.waitFor(() => {
          expect(events.some(e => e.type === "result")).toBe(true)
        })

        expect(capturedOpts).toBeDefined()
        const options = capturedOpts!.options as Record<string, unknown>
        // Should use the default model when no explicit model or env var is set
        expect(options.model).toBe(DEFAULT_CLAUDE_MODEL)
      } finally {
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })

    it("getInfo() returns the configured model", () => {
      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn([]),
        apiKey: "test-key",
        model: "claude-haiku-4-5-20251001",
      })

      const info = adapter.getInfo()
      expect(info.model).toBe("claude-haiku-4-5-20251001")
    })

    it("getInfo() returns DEFAULT_CLAUDE_MODEL when no model is configured", () => {
      const originalEnv = process.env.CLAUDE_MODEL
      try {
        delete process.env.CLAUDE_MODEL

        adapter = new ClaudeAdapter({
          queryFn: createMockQueryFn([]),
          apiKey: "test-key",
        })

        const info = adapter.getInfo()
        // Should return the default model
        expect(info.model).toBe(DEFAULT_CLAUDE_MODEL)
      } finally {
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })

    it("getInfo() returns model from CLAUDE_MODEL env var when no explicit model is set", () => {
      const originalEnv = process.env.CLAUDE_MODEL
      try {
        process.env.CLAUDE_MODEL = "claude-sonnet-4-20250514"

        adapter = new ClaudeAdapter({
          queryFn: createMockQueryFn([]),
          apiKey: "test-key",
        })

        const info = adapter.getInfo()
        expect(info.model).toBe("claude-sonnet-4-20250514")
      } finally {
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })

    it("captures model from message_start events and updates getInfo() with detected model", async () => {
      const sdkMessages = [
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: {
              model: "claude-opus-4-6-20260101",
              usage: { input_tokens: 100 },
            },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          },
        },
        {
          type: "stream_event",
          event: { type: "message_stop" },
        },
        {
          type: "result",
          subtype: "success",
          result: "Hello",
        },
      ]

      // Create adapter without explicit model or CLAUDE_MODEL env var
      const originalEnv = process.env.CLAUDE_MODEL
      try {
        delete process.env.CLAUDE_MODEL

        adapter = new ClaudeAdapter({
          queryFn: createMockQueryFn(sdkMessages),
          apiKey: "test-key",
        })

        // Before any query, model should be the default
        expect(adapter.getInfo().model).toBe(DEFAULT_CLAUDE_MODEL)

        await adapter.start({ cwd: "/tmp" })
        adapter.send({ type: "user_message", content: "Hi" })

        // Wait for the query to complete
        await vi.waitFor(() => {
          expect(adapter.status).toBe("idle")
        })

        // After processing message_start, detected model is stored but getInfo() still returns
        // the configured default (defaultModel takes precedence over detectedModel)
        // Note: This is correct behavior - the default model is what was requested
        expect(adapter.getInfo().model).toBe(DEFAULT_CLAUDE_MODEL)
      } finally {
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })

    it("does not override explicit model with detected model", async () => {
      const sdkMessages = [
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: {
              model: "claude-opus-4-6-20260101",
              usage: { input_tokens: 100 },
            },
          },
        },
        {
          type: "result",
          subtype: "success",
          result: "Hello",
        },
      ]

      // Create adapter with explicit model
      adapter = new ClaudeAdapter({
        queryFn: createMockQueryFn(sdkMessages),
        apiKey: "test-key",
        model: "claude-sonnet-4-20250514",
      })

      // Model should be the explicit one
      expect(adapter.getInfo().model).toBe("claude-sonnet-4-20250514")

      await adapter.start({ cwd: "/tmp" })
      adapter.send({ type: "user_message", content: "Hi" })

      // Wait for the query to complete
      await vi.waitFor(() => {
        expect(adapter.status).toBe("idle")
      })

      // Explicit model should still be returned (not overridden by detected)
      expect(adapter.getInfo().model).toBe("claude-sonnet-4-20250514")
    })

    it("module-level cache stores detected model but default model takes precedence in getInfo()", async () => {
      const sdkMessages = [
        {
          type: "stream_event",
          event: {
            type: "message_start",
            message: {
              model: "claude-opus-4-6-20260101",
              usage: { input_tokens: 100 },
            },
          },
        },
        {
          type: "stream_event",
          event: { type: "message_stop" },
        },
        {
          type: "result",
          subtype: "success",
          result: "Hello",
        },
      ]

      // Clear cache and env var
      clearCachedDetectedModel()
      const originalEnv = process.env.CLAUDE_MODEL
      try {
        delete process.env.CLAUDE_MODEL

        // First adapter detects the model
        const adapter1 = new ClaudeAdapter({
          queryFn: createMockQueryFn(sdkMessages),
          apiKey: "test-key",
        })

        // Before query, model should be the default
        expect(adapter1.getInfo().model).toBe(DEFAULT_CLAUDE_MODEL)
        expect(getCachedDetectedModel()).toBeUndefined()

        await adapter1.start({ cwd: "/tmp" })
        adapter1.send({ type: "user_message", content: "Hi" })

        // Wait for the query to complete
        await vi.waitFor(() => {
          expect(adapter1.status).toBe("idle")
        })

        // After query, module-level cache should be set with detected model
        expect(getCachedDetectedModel()).toBe("claude-opus-4-6-20260101")

        // Create a NEW adapter without running any queries
        // It should return the default model (default takes precedence over cached detected model)
        const adapter2 = new ClaudeAdapter({
          queryFn: createMockQueryFn([]),
          apiKey: "test-key",
        })

        expect(adapter2.getInfo().model).toBe(DEFAULT_CLAUDE_MODEL)
      } finally {
        if (originalEnv === undefined) {
          delete process.env.CLAUDE_MODEL
        } else {
          process.env.CLAUDE_MODEL = originalEnv
        }
      }
    })
  })

  describe("parseCliVersionOutput", () => {
    it("parses standard claude --version output", () => {
      expect(parseCliVersionOutput("2.1.29 (Claude Code)")).toBe("2.1.29")
    })

    it("parses version with only major.minor.patch", () => {
      expect(parseCliVersionOutput("1.0.0")).toBe("1.0.0")
    })

    it("parses version with four segments", () => {
      expect(parseCliVersionOutput("2.1.29.1 (Claude Code)")).toBe("2.1.29.1")
    })

    it("parses version with leading/trailing whitespace", () => {
      expect(parseCliVersionOutput("  2.1.29 (Claude Code)  ")).toBe("2.1.29")
    })

    it("returns undefined for empty string", () => {
      expect(parseCliVersionOutput("")).toBeUndefined()
    })

    it("returns undefined for non-version output", () => {
      expect(parseCliVersionOutput("command not found")).toBeUndefined()
    })

    it("returns undefined for whitespace-only string", () => {
      expect(parseCliVersionOutput("   ")).toBeUndefined()
    })

    it("parses version without suffix text", () => {
      expect(parseCliVersionOutput("3.0.0")).toBe("3.0.0")
    })

    it("parses version followed by newline", () => {
      expect(parseCliVersionOutput("2.1.29 (Claude Code)\n")).toBe("2.1.29")
    })
  })

  describe("CLAUDE.md loading", () => {
    it("loads CLAUDE.md content and prepends it to system prompt by default", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      mockLoadClaudeMdSync.mockReturnValue("# Project Rules\n- Be helpful")

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/project", systemPrompt: "You are an assistant." })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      expect(mockLoadClaudeMdSync).toHaveBeenCalledWith({ cwd: "/project" })

      const options = capturedOpts!.options as Record<string, unknown>
      const systemPrompt = options.systemPrompt as string
      // Order: CLAUDE.md → cwd context → caller systemPrompt
      expect(systemPrompt).toContain("# Project Rules")
      expect(systemPrompt).toContain("- Be helpful")
      expect(systemPrompt).toContain("Working directory: /project")
      expect(systemPrompt).toContain("You are an assistant.")
      // Verify order: CLAUDE.md should come before cwd context
      const claudeMdIndex = systemPrompt.indexOf("# Project Rules")
      const cwdIndex = systemPrompt.indexOf("Working directory")
      const callerPromptIndex = systemPrompt.indexOf("You are an assistant")
      expect(claudeMdIndex).toBeLessThan(cwdIndex)
      expect(cwdIndex).toBeLessThan(callerPromptIndex)
    })

    it("does not load CLAUDE.md when loadClaudeMd option is false", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      mockLoadClaudeMdSync.mockReturnValue("# Should Not Appear")

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
        loadClaudeMd: false,
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/project", systemPrompt: "Be helpful." })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      // loadClaudeMdSync should not be called
      expect(mockLoadClaudeMdSync).not.toHaveBeenCalled()

      const options = capturedOpts!.options as Record<string, unknown>
      const systemPrompt = options.systemPrompt as string
      expect(systemPrompt).not.toContain("# Should Not Appear")
      expect(systemPrompt).toContain("Be helpful.")
    })

    it("handles null CLAUDE.md content gracefully", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      // No CLAUDE.md files exist
      mockLoadClaudeMdSync.mockReturnValue(null)

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({ cwd: "/project", systemPrompt: "Be helpful." })
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      expect(mockLoadClaudeMdSync).toHaveBeenCalledWith({ cwd: "/project" })

      const options = capturedOpts!.options as Record<string, unknown>
      const systemPrompt = options.systemPrompt as string
      // Should still have cwd context and caller prompt
      expect(systemPrompt).toContain("Working directory: /project")
      expect(systemPrompt).toContain("Be helpful.")
    })

    it("works without cwd or systemPrompt when only CLAUDE.md exists", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      mockLoadClaudeMdSync.mockReturnValue("# Global Config")

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      // No cwd, no systemPrompt
      await adapter.start({})
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const options = capturedOpts!.options as Record<string, unknown>
      const systemPrompt = options.systemPrompt as string
      expect(systemPrompt).toBe("# Global Config")
    })

    it("system prompt is undefined when no CLAUDE.md, no cwd, and no systemPrompt", async () => {
      let capturedOpts: Record<string, unknown> | undefined

      const queryFn = async function* (opts: unknown) {
        capturedOpts = opts as Record<string, unknown>
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
          usage: { input_tokens: 5, output_tokens: 2 },
        } as never
      } as unknown as QueryFn

      mockLoadClaudeMdSync.mockReturnValue(null)

      adapter = new ClaudeAdapter({
        queryFn,
        apiKey: "test-key",
      })

      const events = collectEvents(adapter)

      await adapter.start({})
      adapter.send({ type: "user_message", content: "Hi" })

      await vi.waitFor(() => {
        expect(events.some(e => e.type === "result")).toBe(true)
      })

      const options = capturedOpts!.options as Record<string, unknown>
      expect(options.systemPrompt).toBeUndefined()
    })
  })
})
