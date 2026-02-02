import { describe, it, expect, beforeEach, vi } from "vitest"
import { ClaudeAdapter, type QueryFn } from "./ClaudeAdapter.js"
import type { AgentEvent, AgentStatusEvent } from "./agentTypes.js"

/**
 * Create a mock queryFn that yields the given SDK messages.
 * The returned async generator yields each message in order.
 */
function createMockQueryFn(messages: Array<Record<string, unknown>>): QueryFn {
  return (async function* (_opts: unknown) {
    for (const msg of messages) {
      yield msg as never
    }
  }) as unknown as QueryFn
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
        (e): e is AgentStatusEvent => e.type === "status" && (e as AgentStatusEvent).status === "idle",
      )
      expect(idleStatusEvents.length).toBe(1)
      expect(idleStatusEvents[0].status).toBe("idle")
    })

    it("does not emit idle status when the query throws a non-retryable error", async () => {
      const queryFn = (async function* (_opts: unknown) {
        throw new Error("invalid API key")
      }) as unknown as QueryFn

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
        content: [
          { type: "text", text: "Hello there." },
        ],
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
        content: [
          { type: "text", text: "The answer is 42." },
        ],
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
})
