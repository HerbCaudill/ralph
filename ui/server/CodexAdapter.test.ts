import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ThreadEvent } from "@openai/codex-sdk"
import { CodexAdapter, type CodexFactory } from "./CodexAdapter"
import type {
  AgentEvent,
  AgentMessageEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatus,
} from "./AgentAdapter"

function createEventStream(events: ThreadEvent[]) {
  async function* stream() {
    for (const event of events) {
      yield event
    }
  }
  return stream()
}

describe("CodexAdapter", () => {
  let adapter: CodexAdapter
  let mockStartThread: ReturnType<typeof vi.fn>
  let mockRunStreamed: ReturnType<typeof vi.fn>
  let mockCreateCodex: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRunStreamed = vi.fn().mockResolvedValue({ events: createEventStream([]) })
    mockStartThread = vi.fn().mockReturnValue({ runStreamed: mockRunStreamed })
    mockCreateCodex = vi.fn().mockReturnValue({ startThread: mockStartThread })
    adapter = new CodexAdapter({ createCodex: mockCreateCodex as unknown as CodexFactory })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("getInfo", () => {
    it("returns correct adapter info", () => {
      const info = adapter.getInfo()
      expect(info.id).toBe("codex")
      expect(info.name).toBe("Codex")
      expect(info.features.streaming).toBe(true)
      expect(info.features.tools).toBe(true)
      expect(info.features.pauseResume).toBe(false)
      expect(info.features.systemPrompt).toBe(false)
    })
  })

  describe("isAvailable", () => {
    it("returns true when apiKey option is provided", async () => {
      const custom = new CodexAdapter({ apiKey: "test-key", createCodex: mockCreateCodex })
      expect(await custom.isAvailable()).toBe(true)
    })

    it("returns false when no api key is present", async () => {
      const previous = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        CODEX_API_KEY: process.env.CODEX_API_KEY,
      }
      delete process.env.OPENAI_API_KEY
      delete process.env.CODEX_API_KEY

      expect(await adapter.isAvailable()).toBe(false)

      process.env.OPENAI_API_KEY = previous.OPENAI_API_KEY
      process.env.CODEX_API_KEY = previous.CODEX_API_KEY
    })
  })

  describe("start", () => {
    it("creates a thread with expected options", async () => {
      await adapter.start({ model: "o3-mini", cwd: "/test/project" })

      expect(mockCreateCodex).toHaveBeenCalled()
      expect(mockStartThread).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "o3-mini",
          workingDirectory: "/test/project",
          skipGitRepoCheck: true,
          sandboxMode: "danger-full-access",
          approvalPolicy: "never",
          networkAccessEnabled: true,
        }),
      )
    })

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
      await adapter.start()
    })

    it("runs a turn with the prompt", async () => {
      mockRunStreamed.mockResolvedValueOnce({ events: createEventStream([]) })

      adapter.send({ type: "user_message", content: "Hello Codex!" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      expect(mockRunStreamed).toHaveBeenCalledWith("Hello Codex!", expect.any(Object))
    })

    it("throws if not running", () => {
      const stopped = new CodexAdapter({ createCodex: mockCreateCodex as CodexFactory })
      expect(() => stopped.send({ type: "user_message", content: "test" })).toThrow("not running")
    })
  })

  describe("event translation", () => {
    beforeEach(async () => {
      await adapter.start()
    })

    it("translates message, tool use, and result events", async () => {
      const events: AgentEvent[] = []
      adapter.on("event", e => events.push(e))

      mockRunStreamed.mockResolvedValueOnce({
        events: createEventStream([
          { type: "turn.started" } as ThreadEvent,
          {
            type: "item.started",
            item: { id: "tool-1", type: "command_execution", command: "ls", status: "in_progress" },
          } as ThreadEvent,
          {
            type: "item.completed",
            item: {
              id: "msg-1",
              type: "agent_message",
              text: "Hello from Codex!",
            },
          } as ThreadEvent,
          {
            type: "item.completed",
            item: {
              id: "tool-1",
              type: "command_execution",
              aggregated_output: "file.txt",
              exit_code: 0,
              status: "completed",
            },
          } as ThreadEvent,
          {
            type: "turn.completed",
            usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
          } as ThreadEvent,
        ]),
      })

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
      const toolUseEvents = events.filter(e => e.type === "tool_use") as AgentToolUseEvent[]
      const toolResultEvents = events.filter(
        e => e.type === "tool_result",
      ) as AgentToolResultEvent[]
      const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]

      expect(messageEvents).toHaveLength(1)
      expect(messageEvents[0].content).toBe("Hello from Codex!")
      expect(toolUseEvents).toHaveLength(1)
      expect(toolUseEvents[0].tool).toBe("bash")
      expect(toolResultEvents).toHaveLength(1)
      expect(toolResultEvents[0].output).toBe("file.txt")
      expect(resultEvents).toHaveLength(1)
      expect(resultEvents[0].usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      })
    })

    it("emits error on turn failure", async () => {
      const events: AgentEvent[] = []
      const errors: Error[] = []
      adapter.on("event", e => events.push(e))
      adapter.on("error", e => errors.push(e))

      mockRunStreamed.mockResolvedValueOnce({
        events: createEventStream([
          {
            type: "turn.failed",
            error: { message: "Boom" },
          } as ThreadEvent,
        ]),
      })

      adapter.send({ type: "user_message", content: "Hi" })
      await (adapter as unknown as { inFlight: Promise<void> | null }).inFlight

      const errorEvents = events.filter(e => e.type === "error") as AgentErrorEvent[]
      expect(errorEvents).toHaveLength(1)
      expect(errorEvents[0].message).toBe("Boom")
      expect(errors).toHaveLength(1)
    })
  })
})
