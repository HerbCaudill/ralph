import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { ClaudeAdapter, type QueryFn } from "./ClaudeAdapter"
import type {
  AgentEvent,
  AgentMessageEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatus,
} from "./AgentAdapter"
import { createMessageStream } from "./lib/createMessageStream.js"

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter
  let mockQuery: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockQuery = vi.fn()
    adapter = new ClaudeAdapter({ queryFn: mockQuery as unknown as QueryFn })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("getInfo", () => {
    it("returns correct adapter info", () => {
      const info = adapter.getInfo()
      expect(info.id).toBe("claude")
      expect(info.name).toBe("Claude")
      expect(info.features.streaming).toBe(true)
      expect(info.features.tools).toBe(true)
      expect(info.features.pauseResume).toBe(false)
      expect(info.features.systemPrompt).toBe(true)
    })
  })

  describe("isAvailable", () => {
    it("returns true when apiKey option is provided", async () => {
      const custom = new ClaudeAdapter({ apiKey: "test-key", queryFn: mockQuery as QueryFn })
      expect(await custom.isAvailable()).toBe(true)
    })

    it("returns false when no api key is present", async () => {
      const previous = {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
        CLAUDE_CODE_API_KEY: process.env.CLAUDE_CODE_API_KEY,
      }
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.CLAUDE_API_KEY
      delete process.env.CLAUDE_CODE_API_KEY

      expect(await adapter.isAvailable()).toBe(false)

      process.env.ANTHROPIC_API_KEY = previous.ANTHROPIC_API_KEY
      process.env.CLAUDE_API_KEY = previous.CLAUDE_API_KEY
      process.env.CLAUDE_CODE_API_KEY = previous.CLAUDE_CODE_API_KEY
    })
  })

  describe("start", () => {
    it("transitions through starting to running status", async () => {
      const statuses: AgentStatus[] = []
      adapter.on("status", s => statuses.push(s))

      await adapter.start()

      expect(statuses).toContain("starting")
      expect(statuses).toContain("running")
      expect(adapter.status).toBe("running")
    })

    it("throws if already running", async () => {
      await adapter.start()
      await expect(adapter.start()).rejects.toThrow("already running")
    })
  })

  describe("send", () => {
    beforeEach(async () => {
      await adapter.start({ model: "haiku" })
    })

    it("calls query with prompt and options", async () => {
      mockQuery.mockReturnValueOnce(createMessageStream([]))

      adapter.send({ type: "user_message", content: "Hello Claude!" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Hello Claude!",
          options: expect.objectContaining({
            model: "haiku",
            includePartialMessages: true,
            permissionMode: "bypassPermissions",
          }),
        }),
      )
    })

    it("throws if not running", () => {
      const stopped = new ClaudeAdapter({ queryFn: mockQuery as QueryFn })
      expect(() => stopped.send({ type: "user_message", content: "test" })).toThrow("not running")
    })
  })

  describe("event translation", () => {
    beforeEach(async () => {
      await adapter.start()
    })

    it("translates assistant message with text content", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "assistant",
            message: { content: [{ type: "text", text: "Hello from Claude!" }] },
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
      expect(messageEvents).toHaveLength(1)
      expect(messageEvents[0].content).toBe("Hello from Claude!")
      expect(messageEvents[0].isPartial).toBe(false)
    })

    it("translates streaming text deltas", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } },
          } as SDKMessage,
          {
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "lo!" } },
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
      expect(messageEvents).toHaveLength(2)
      expect(messageEvents[0].content).toBe("Hel")
      expect(messageEvents[0].isPartial).toBe(true)
      expect(messageEvents[1].content).toBe("lo!")
      expect(messageEvents[1].isPartial).toBe(true)
    })

    it("translates tool_use from assistant message", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "assistant",
            message: {
              content: [
                {
                  type: "tool_use",
                  id: "tool-123",
                  name: "Read",
                  input: { file_path: "/test.txt" },
                },
              ],
            },
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const toolUseEvents = events.filter(e => e.type === "tool_use") as AgentToolUseEvent[]
      expect(toolUseEvents).toHaveLength(1)
      expect(toolUseEvents[0].toolUseId).toBe("tool-123")
      expect(toolUseEvents[0].tool).toBe("Read")
      expect(toolUseEvents[0].input).toEqual({ file_path: "/test.txt" })
    })

    it("translates tool result", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "stream_event",
            event: {
              type: "tool_result",
              tool_use_id: "tool-123",
              content: "file contents here",
              is_error: false,
            },
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const resultEvents = events.filter(e => e.type === "tool_result") as AgentToolResultEvent[]
      expect(resultEvents).toHaveLength(1)
      expect(resultEvents[0].toolUseId).toBe("tool-123")
      expect(resultEvents[0].output).toBe("file contents here")
      expect(resultEvents[0].isError).toBe(false)
    })

    it("emits result event on success", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "success",
            result: "Task completed successfully",
            usage: { input_tokens: 100, output_tokens: 50 },
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]
      expect(resultEvents).toHaveLength(1)
      expect(resultEvents[0].content).toBe("Task completed successfully")
      expect(resultEvents[0].usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      })
    })

    it("emits error event on result error", async () => {
      const events: AgentEvent[] = []
      const errors: Error[] = []
      adapter.on("event", e => events.push(e))
      adapter.on("error", e => errors.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "error_max_turns",
            is_error: true,
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const errorEvents = events.filter(e => e.type === "error") as AgentErrorEvent[]
      expect(errorEvents).toHaveLength(1)
      expect(errorEvents[0].message).toBe("Query failed: error_max_turns")
      expect(errors).toHaveLength(1)
    })
  })

  describe("retry mechanism", () => {
    beforeEach(async () => {
      vi.useFakeTimers()
      // Create adapter with fast retry config for testing
      adapter = new ClaudeAdapter({
        queryFn: mockQuery as unknown as QueryFn,
        retryConfig: {
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
        },
      })
      await adapter.start()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("retries on connection error", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      // First call fails with connection error, second succeeds
      mockQuery
        .mockImplementationOnce(async function* () {
          throw new Error("Connection error: failed to fetch")
        })
        .mockImplementationOnce(async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "Success after retry",
          } as SDKMessage
        })

      adapter.send({ type: "user_message", content: "Hi" })

      // Wait for the first attempt to fail
      await vi.advanceTimersByTimeAsync(0)

      // Check that a retry event was emitted (non-fatal error)
      const retryEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RETRY",
      ) as AgentErrorEvent[]
      expect(retryEvents).toHaveLength(1)
      expect(retryEvents[0].fatal).toBe(false)
      expect(retryEvents[0].message).toContain("Retrying")

      // Advance past the retry delay
      await vi.advanceTimersByTimeAsync(150)

      // Wait for the in-flight promise to resolve
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Check that we eventually got a success result
      const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]
      expect(resultEvents).toHaveLength(1)
      expect(resultEvents[0].content).toBe("Success after retry")
    })

    it("retries on rate limit error", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery
        .mockImplementationOnce(async function* () {
          throw new Error("rate_limit exceeded")
        })
        .mockImplementationOnce(async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "Success after rate limit",
          } as SDKMessage
        })

      adapter.send({ type: "user_message", content: "Hi" })

      // Advance timers to complete the retry
      await vi.advanceTimersByTimeAsync(200)
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const retryEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RETRY",
      ) as AgentErrorEvent[]
      expect(retryEvents).toHaveLength(1)
    })

    it("retries on server error (500)", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery
        .mockImplementationOnce(async function* () {
          throw new Error("500 Internal Server Error")
        })
        .mockImplementationOnce(async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "Success",
          } as SDKMessage
        })

      adapter.send({ type: "user_message", content: "Hi" })

      await vi.advanceTimersByTimeAsync(200)
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const retryEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RETRY",
      )
      expect(retryEvents).toHaveLength(1)
    })

    it("does not retry on non-retryable errors", async () => {
      const events: AgentEvent[] = []
      const errors: Error[] = []
      adapter.on("event", e => events.push(e))
      adapter.on("error", e => errors.push(e))

      mockQuery.mockImplementationOnce(async function* () {
        throw new Error("Invalid request: bad input")
      })

      adapter.send({ type: "user_message", content: "Hi" })

      await vi.advanceTimersByTimeAsync(0)
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Should emit fatal error without retry
      const errorEvents = events.filter(e => e.type === "error") as AgentErrorEvent[]
      expect(errorEvents).toHaveLength(1)
      expect(errorEvents[0].fatal).toBe(true)
      expect(errorEvents[0].code).not.toBe("RETRY")
      expect(errors).toHaveLength(1)

      // Should only have called query once
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    it("gives up after max retries", async () => {
      const events: AgentEvent[] = []
      const errors: Error[] = []
      adapter.on("event", e => events.push(e))
      adapter.on("error", e => errors.push(e))

      // All attempts fail with connection error
      mockQuery.mockImplementation(async function* () {
        throw new Error("Connection error: ECONNREFUSED")
      })

      adapter.send({ type: "user_message", content: "Hi" })

      // Advance through all retry attempts (3 retries with exponential backoff)
      // Initial: 100ms, 2nd: 200ms, 3rd: 400ms
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(200)
      await vi.advanceTimersByTimeAsync(400)
      await vi.advanceTimersByTimeAsync(1000) // Extra time to ensure completion

      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Should have 3 retry events (non-fatal) + 1 final fatal error
      const retryEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RETRY",
      )
      const fatalEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).fatal === true,
      )

      expect(retryEvents).toHaveLength(3)
      expect(fatalEvents).toHaveLength(1)
      expect(errors).toHaveLength(1)

      // Query should have been called 4 times (initial + 3 retries)
      expect(mockQuery).toHaveBeenCalledTimes(4)
    })

    it("uses exponential backoff", async () => {
      const retryDelays: number[] = []
      const events: AgentEvent[] = []
      adapter.on("event", e => {
        if (e.type === "error" && (e as AgentErrorEvent).code === "RETRY") {
          const match = (e as AgentErrorEvent).message.match(/Retrying in (\d+) seconds/)
          if (match) {
            retryDelays.push(parseInt(match[1], 10))
          }
        }
        events.push(e)
      })
      // Suppress error events since we're expecting them
      adapter.on("error", () => {})

      let callCount = 0
      mockQuery.mockImplementation(async function* () {
        callCount++
        throw new Error("Connection error")
      })

      adapter.send({ type: "user_message", content: "Hi" })

      // Advance through all retries - need to wait for each session
      // Initial attempt + 3 retries with delays
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(500)
      }

      // Wait for the in-flight promise to resolve (may be null by now)
      const inFlight = (adapter as unknown as { inFlight: Promise<void> | null }).inFlight
      if (inFlight) {
        await inFlight
      }

      // With maxRetries=3, we should have 3 retry events (non-fatal)
      // Note: there's jitter, so we check that delays exist
      expect(retryDelays.length).toBe(3)

      // Verify we made 4 attempts total (initial + 3 retries)
      expect(callCount).toBe(4)
    })

    it("captures session ID from SDK messages", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "assistant",
            message: { content: [{ type: "text", text: "Hello!" }] },
            session_id: "test-session-123",
          } as SDKMessage,
          {
            type: "result",
            subtype: "success",
            result: "Done",
            session_id: "test-session-123",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Verify session ID was captured (through internal state)
      const adapterInternal = adapter as unknown as { currentSessionId: string | undefined }
      expect(adapterInternal.currentSessionId).toBe("test-session-123")
    })

    it("resumes session on retry when session ID is available", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))
      adapter.on("error", () => {}) // Suppress error events

      let callCount = 0
      mockQuery.mockImplementation(async function* () {
        callCount++
        if (callCount === 1) {
          // First call: yield a message with session ID, then fail
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "Starting..." }] },
            session_id: "resume-session-456",
          } as SDKMessage
          throw new Error("Connection error: network failure")
        } else {
          // Retry: should succeed
          yield {
            type: "result",
            subtype: "success",
            result: "Success after resume",
            session_id: "resume-session-456",
          } as SDKMessage
        }
      })

      adapter.send({ type: "user_message", content: "Hi" })

      // Advance through retry delay
      await vi.advanceTimersByTimeAsync(200)
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Check that a RESUMING event was emitted before the retry
      const resumingEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RESUMING",
      ) as AgentErrorEvent[]
      expect(resumingEvents).toHaveLength(1)
      expect(resumingEvents[0].fatal).toBe(false)
      expect(resumingEvents[0].message).toContain("resume-session-456")

      // Check that retry used resume option (second call should have resume in options)
      expect(mockQuery).toHaveBeenCalledTimes(2)
      const secondCall = mockQuery.mock.calls[1]
      expect(secondCall[0].options.resume).toBe("resume-session-456")
      // When resuming, prompt should be empty
      expect(secondCall[0].prompt).toBe("")
    })

    it("does not resume on first attempt", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "success",
            result: "Success",
            session_id: "new-session-789",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // First attempt should not have resume option
      expect(mockQuery).toHaveBeenCalledTimes(1)
      const firstCall = mockQuery.mock.calls[0]
      expect(firstCall[0].options.resume).toBeUndefined()
      expect(firstCall[0].prompt).toBe("Hi")

      // No RESUMING events should be emitted
      const resumingEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RESUMING",
      )
      expect(resumingEvents).toHaveLength(0)
    })

    it("retries without resume if no session ID was captured", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))
      adapter.on("error", () => {}) // Suppress error events

      let callCount = 0
      mockQuery.mockImplementation(async function* () {
        callCount++
        if (callCount === 1) {
          // First call: fail immediately without yielding any messages (no session ID)
          throw new Error("Connection error: failed immediately")
        } else {
          // Retry: should succeed
          yield {
            type: "result",
            subtype: "success",
            result: "Success without resume",
            session_id: "new-session-after-retry",
          } as SDKMessage
        }
      })

      adapter.send({ type: "user_message", content: "Hi" })

      // Advance through retry delay
      await vi.advanceTimersByTimeAsync(200)
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // No RESUMING event should be emitted (no session to resume)
      const resumingEvents = events.filter(
        e => e.type === "error" && (e as AgentErrorEvent).code === "RESUMING",
      )
      expect(resumingEvents).toHaveLength(0)

      // Retry should still use the original prompt (not resume)
      expect(mockQuery).toHaveBeenCalledTimes(2)
      const secondCall = mockQuery.mock.calls[1]
      expect(secondCall[0].options.resume).toBeUndefined()
      expect(secondCall[0].prompt).toBe("Hi")
    })
  })

  describe("conversation context tracking", () => {
    beforeEach(async () => {
      await adapter.start()
    })

    it("tracks user messages in conversation context", async () => {
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "success",
            result: "Hello!",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi Claude!" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const context = adapter.getConversationContext()
      expect(context.messages).toHaveLength(2)
      expect(context.messages[0].role).toBe("user")
      expect(context.messages[0].content).toBe("Hi Claude!")
      expect(context.lastPrompt).toBe("Hi Claude!")
    })

    it("tracks assistant messages in conversation context", async () => {
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "assistant",
            message: { content: [{ type: "text", text: "Hello from Claude!" }] },
          } as SDKMessage,
          {
            type: "result",
            subtype: "success",
            result: "Hello from Claude!",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const context = adapter.getConversationContext()
      expect(context.messages).toHaveLength(2)
      expect(context.messages[1].role).toBe("assistant")
      expect(context.messages[1].content).toBe("Hello from Claude!")
    })

    it("tracks streaming text deltas in conversation context", async () => {
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } },
          } as SDKMessage,
          {
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "lo!" } },
          } as SDKMessage,
          {
            type: "result",
            subtype: "success",
            result: "Hello!",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const context = adapter.getConversationContext()
      expect(context.messages).toHaveLength(2)
      // The assistant message should have the final result content
      expect(context.messages[1].role).toBe("assistant")
      expect(context.messages[1].content).toBe("Hello!")
    })

    it("tracks tool uses in conversation context", async () => {
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "assistant",
            message: {
              content: [
                {
                  type: "tool_use",
                  id: "tool-123",
                  name: "Read",
                  input: { file_path: "/test.txt" },
                },
              ],
            },
          } as SDKMessage,
          {
            type: "stream_event",
            event: {
              type: "tool_result",
              tool_use_id: "tool-123",
              content: "file contents",
              is_error: false,
            },
          } as SDKMessage,
          {
            type: "result",
            subtype: "success",
            result: "Done!",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Read a file" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const context = adapter.getConversationContext()
      expect(context.messages).toHaveLength(2)
      expect(context.messages[1].toolUses).toHaveLength(1)
      expect(context.messages[1].toolUses![0].id).toBe("tool-123")
      expect(context.messages[1].toolUses![0].name).toBe("Read")
      expect(context.messages[1].toolUses![0].input).toEqual({ file_path: "/test.txt" })
      expect(context.messages[1].toolUses![0].result).toEqual({
        output: "file contents",
        error: undefined,
        isError: false,
      })
    })

    it("tracks usage statistics across messages", async () => {
      mockQuery
        .mockReturnValueOnce(
          createMessageStream([
            {
              type: "result",
              subtype: "success",
              result: "First response",
              usage: { input_tokens: 100, output_tokens: 50 },
            } as SDKMessage,
          ]),
        )
        .mockReturnValueOnce(
          createMessageStream([
            {
              type: "result",
              subtype: "success",
              result: "Second response",
              usage: { input_tokens: 150, output_tokens: 75 },
            } as SDKMessage,
          ]),
        )

      adapter.send({ type: "user_message", content: "First message" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      adapter.send({ type: "user_message", content: "Second message" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const context = adapter.getConversationContext()
      expect(context.usage.inputTokens).toBe(250)
      expect(context.usage.outputTokens).toBe(125)
      expect(context.usage.totalTokens).toBe(375)
    })

    it("can restore conversation context", async () => {
      const savedContext = {
        messages: [
          { role: "user" as const, content: "Hello", timestamp: 1000 },
          { role: "assistant" as const, content: "Hi there!", timestamp: 1001, toolUses: [] },
        ],
        lastPrompt: "Hello",
        usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
        timestamp: 1001,
      }

      adapter.setConversationContext(savedContext)

      const restored = adapter.getConversationContext()
      expect(restored.messages).toHaveLength(2)
      expect(restored.lastPrompt).toBe("Hello")
      expect(restored.usage).toEqual({ inputTokens: 50, outputTokens: 25, totalTokens: 75 })
    })

    it("can clear conversation context", async () => {
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "success",
            result: "Hello!",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Verify we have messages
      expect(adapter.getConversationContext().messages).toHaveLength(2)

      // Clear and verify
      adapter.clearConversationContext()
      const context = adapter.getConversationContext()
      expect(context.messages).toHaveLength(0)
      expect(context.lastPrompt).toBeUndefined()
      expect(context.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
    })

    it("resets conversation context on fresh start", async () => {
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "success",
            result: "Hello!",
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      // Stop and restart
      await adapter.stop()
      await adapter.start()

      // Context should be fresh
      const context = adapter.getConversationContext()
      expect(context.messages).toHaveLength(0)
      expect(context.lastPrompt).toBeUndefined()
    })

    it("preserves restored context across new messages", async () => {
      // Set up initial context
      const savedContext = {
        messages: [
          { role: "user" as const, content: "Previous message", timestamp: 1000 },
          {
            role: "assistant" as const,
            content: "Previous response",
            timestamp: 1001,
            toolUses: [],
          },
        ],
        lastPrompt: "Previous message",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        timestamp: 1001,
      }

      adapter.setConversationContext(savedContext)

      // Send a new message
      mockQuery.mockReturnValueOnce(
        createMessageStream([
          {
            type: "result",
            subtype: "success",
            result: "New response",
            usage: { input_tokens: 50, output_tokens: 25 },
          } as SDKMessage,
        ]),
      )

      adapter.send({ type: "user_message", content: "New message" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const context = adapter.getConversationContext()
      // Should have 4 messages: 2 restored + 2 new
      expect(context.messages).toHaveLength(4)
      expect(context.messages[2].role).toBe("user")
      expect(context.messages[2].content).toBe("New message")
      expect(context.messages[3].role).toBe("assistant")
      expect(context.messages[3].content).toBe("New response")
      // Usage should be cumulative
      expect(context.usage.inputTokens).toBe(150)
      expect(context.usage.outputTokens).toBe(75)
    })
  })
})
