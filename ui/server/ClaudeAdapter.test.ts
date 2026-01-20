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

function createMessageStream(messages: SDKMessage[]) {
  async function* stream() {
    for (const message of messages) {
      yield message
    }
  }
  return stream()
}

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
})
