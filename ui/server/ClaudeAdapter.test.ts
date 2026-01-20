import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { ClaudeAdapter, type SpawnFn } from "./ClaudeAdapter"
import type {
  AgentEvent,
  AgentMessageEvent,
  AgentToolUseEvent,
  AgentToolResultEvent,
  AgentResultEvent,
  AgentErrorEvent,
  AgentStatus,
} from "./AgentAdapter"

// Create a mock process helper
function createMockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { writable: boolean; write: ReturnType<typeof vi.fn> }
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  proc.stdin = { writable: true, write: vi.fn() }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter
  let mockProcess: ReturnType<typeof createMockProcess>
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockProcess = createMockProcess()
    mockSpawn = vi.fn().mockReturnValue(mockProcess)
    adapter = new ClaudeAdapter({
      spawn: mockSpawn as unknown as SpawnFn,
    })
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
    it("returns true when claude command succeeds", async () => {
      const versionProcess = createMockProcess()
      mockSpawn.mockReturnValueOnce(versionProcess)

      const promise = adapter.isAvailable()
      versionProcess.emit("exit", 0)

      expect(await promise).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith("claude", ["--version"], expect.any(Object))
    })

    it("returns false when claude command fails", async () => {
      const versionProcess = createMockProcess()
      mockSpawn.mockReturnValueOnce(versionProcess)

      const promise = adapter.isAvailable()
      versionProcess.emit("exit", 1)

      expect(await promise).toBe(false)
    })

    it("returns false when spawn throws", async () => {
      mockSpawn.mockImplementationOnce(() => {
        throw new Error("Command not found")
      })

      expect(await adapter.isAvailable()).toBe(false)
    })

    it("returns false on spawn error event", async () => {
      const versionProcess = createMockProcess()
      mockSpawn.mockReturnValueOnce(versionProcess)

      const promise = adapter.isAvailable()
      versionProcess.emit("error", new Error("ENOENT"))

      expect(await promise).toBe(false)
    })
  })

  describe("start", () => {
    it("spawns claude with correct default arguments", async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        ["--verbose", "--output-format", "stream-json"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      )
    })

    it("includes model option when provided", async () => {
      const promise = adapter.start({ model: "haiku" })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        ["--verbose", "--output-format", "stream-json", "--model", "haiku"],
        expect.any(Object),
      )
    })

    it("includes system prompt when provided", async () => {
      const promise = adapter.start({ systemPrompt: "You are helpful." })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        ["--verbose", "--output-format", "stream-json", "--system-prompt", "You are helpful."],
        expect.any(Object),
      )
    })

    it("includes max-turns when maxIterations provided", async () => {
      const promise = adapter.start({ maxIterations: 5 })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        ["--verbose", "--output-format", "stream-json", "--max-turns", "5"],
        expect.any(Object),
      )
    })

    it("passes cwd to spawn", async () => {
      const promise = adapter.start({ cwd: "/test/project" })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        expect.any(Array),
        expect.objectContaining({
          cwd: "/test/project",
        }),
      )
    })

    it("passes env to spawn", async () => {
      const promise = adapter.start({ env: { CUSTOM_VAR: "value" } })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ CUSTOM_VAR: "value" }),
        }),
      )
    })

    it("transitions through starting to running status", async () => {
      const statuses: AgentStatus[] = []
      adapter.on("status", s => statuses.push(s))

      const promise = adapter.start()
      expect(adapter.status).toBe("starting")

      mockProcess.emit("spawn")
      await promise

      expect(statuses).toContain("starting")
      expect(statuses).toContain("running")
      expect(adapter.status).toBe("running")
    })

    it("throws if already running", async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise

      await expect(adapter.start()).rejects.toThrow("already running")
    })

    it("rejects on spawn error", async () => {
      // Add error handler to prevent unhandled error
      adapter.on("error", () => {})

      const promise = adapter.start()
      mockProcess.emit("error", new Error("spawn failed"))

      await expect(promise).rejects.toThrow("spawn failed")
      expect(adapter.status).toBe("stopped")
    })
  })

  describe("send", () => {
    beforeEach(async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise
    })

    it("sends user message to stdin", () => {
      adapter.send({ type: "user_message", content: "Hello Claude!" })

      expect(mockProcess.stdin.write).toHaveBeenCalledWith("Hello Claude!\n")
    })

    it("handles stop control command", async () => {
      // Set up for stop
      const exitPromise = new Promise<void>(resolve => {
        adapter.once("exit", () => resolve())
      })

      adapter.send({ type: "control", command: "stop" })

      expect(mockProcess.kill).toHaveBeenCalled()
    })

    it("throws if not running", async () => {
      const stopPromise = adapter.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(() => adapter.send({ type: "user_message", content: "test" })).toThrow("not running")
    })
  })

  describe("stop", () => {
    beforeEach(async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise
    })

    it("sends SIGTERM by default", async () => {
      const stopPromise = adapter.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")
    })

    it("sends SIGKILL when force is true", async () => {
      const stopPromise = adapter.stop(true)
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGKILL")
    })

    it("transitions to stopping then stopped", async () => {
      const statuses: AgentStatus[] = []
      adapter.on("status", s => statuses.push(s))

      const stopPromise = adapter.stop()
      expect(adapter.status).toBe("stopping")

      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(statuses).toContain("stopping")
      expect(statuses).toContain("stopped")
    })

    it("resolves immediately if not running", async () => {
      // First stop the running adapter
      const stopPromise = adapter.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      // Second stop should resolve immediately since process is null
      await adapter.stop()
    })
  })

  describe("event translation", () => {
    beforeEach(async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise
    })

    describe("message events", () => {
      it("translates assistant message with text content", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Hello from Claude!" }],
          },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
        expect(messageEvents).toHaveLength(1)
        expect(messageEvents[0].content).toBe("Hello from Claude!")
        expect(messageEvents[0].isPartial).toBe(false)
      })

      it("translates streaming text deltas", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const delta1 = { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } }
        const delta2 = { type: "content_block_delta", delta: { type: "text_delta", text: "lo!" } }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(delta1) + "\n"))
        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(delta2) + "\n"))

        const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
        expect(messageEvents).toHaveLength(2)
        expect(messageEvents[0].content).toBe("Hel")
        expect(messageEvents[0].isPartial).toBe(true)
        expect(messageEvents[1].content).toBe("lo!")
        expect(messageEvents[1].isPartial).toBe(true)
      })
    })

    describe("tool use events", () => {
      it("translates tool_use from assistant message", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
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
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const toolUseEvents = events.filter(e => e.type === "tool_use") as AgentToolUseEvent[]
        expect(toolUseEvents).toHaveLength(1)
        expect(toolUseEvents[0].toolUseId).toBe("tool-123")
        expect(toolUseEvents[0].tool).toBe("Read")
        expect(toolUseEvents[0].input).toEqual({ file_path: "/test.txt" })
      })

      it("translates standalone tool_use event", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "tool_use",
          id: "tool-456",
          name: "Bash",
          input: { command: "ls" },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const toolUseEvents = events.filter(e => e.type === "tool_use") as AgentToolUseEvent[]
        expect(toolUseEvents).toHaveLength(1)
        expect(toolUseEvents[0].toolUseId).toBe("tool-456")
        expect(toolUseEvents[0].tool).toBe("Bash")
      })
    })

    describe("tool result events", () => {
      it("translates successful tool result", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "tool_result",
          tool_use_id: "tool-123",
          content: "file contents here",
          is_error: false,
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const resultEvents = events.filter(e => e.type === "tool_result") as AgentToolResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].toolUseId).toBe("tool-123")
        expect(resultEvents[0].output).toBe("file contents here")
        expect(resultEvents[0].isError).toBe(false)
        expect(resultEvents[0].error).toBeUndefined()
      })

      it("translates error tool result", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "tool_result",
          tool_use_id: "tool-123",
          content: "File not found",
          is_error: true,
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const resultEvents = events.filter(e => e.type === "tool_result") as AgentToolResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].isError).toBe(true)
        expect(resultEvents[0].error).toBe("File not found")
        expect(resultEvents[0].output).toBeUndefined()
      })
    })

    describe("result events", () => {
      it("translates result event with string result", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "result",
          result: "Task completed successfully",
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].content).toBe("Task completed successfully")
      })

      it("translates result event with usage stats", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "result",
          result: "Done",
          usage: { input_tokens: 100, output_tokens: 50 },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].usage).toEqual({
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        })
      })
    })

    describe("error events", () => {
      it("translates error event with error string", () => {
        const events: AgentEvent[] = []
        const errors: Error[] = []
        adapter.on("event", e => events.push(e))
        adapter.on("error", e => errors.push(e))

        const nativeEvent = {
          type: "error",
          error: "Rate limit exceeded",
          code: "RATE_LIMIT",
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const errorEvents = events.filter(e => e.type === "error") as AgentErrorEvent[]
        expect(errorEvents).toHaveLength(1)
        expect(errorEvents[0].message).toBe("Rate limit exceeded")
        expect(errorEvents[0].code).toBe("RATE_LIMIT")
        expect(errorEvents[0].fatal).toBe(true)

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toBe("Rate limit exceeded")
      })

      it("translates error event with message string", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "error",
          message: "Something went wrong",
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const errorEvents = events.filter(e => e.type === "error") as AgentErrorEvent[]
        expect(errorEvents).toHaveLength(1)
        expect(errorEvents[0].message).toBe("Something went wrong")
      })
    })

    describe("lifecycle events", () => {
      it("ignores message_start, message_delta, message_stop events", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const lifecycleEvents = [
          { type: "message_start" },
          { type: "message_delta" },
          { type: "message_stop" },
        ]

        for (const event of lifecycleEvents) {
          mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(event) + "\n"))
        }

        // Filter out status events from start
        const nonStatusEvents = events.filter(e => e.type !== "status")
        expect(nonStatusEvents).toHaveLength(0)
      })
    })

    describe("buffering", () => {
      it("handles partial JSON across multiple chunks", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const fullJson = '{"type":"result","result":"Complete"}\n'
        const part1 = fullJson.slice(0, 15)
        const part2 = fullJson.slice(15)

        mockProcess.stdout.emit("data", Buffer.from(part1))
        expect(events.filter(e => e.type === "result")).toHaveLength(0)

        mockProcess.stdout.emit("data", Buffer.from(part2))
        expect(events.filter(e => e.type === "result")).toHaveLength(1)
      })

      it("handles multiple events in single chunk", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const multipleEvents =
          '{"type":"result","result":"One"}\n{"type":"result","result":"Two"}\n'

        mockProcess.stdout.emit("data", Buffer.from(multipleEvents))

        const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]
        expect(resultEvents).toHaveLength(2)
        expect(resultEvents[0].content).toBe("One")
        expect(resultEvents[1].content).toBe("Two")
      })

      it("ignores invalid JSON lines", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        mockProcess.stdout.emit("data", Buffer.from("not valid json\n"))

        // Should not throw and should not emit any events
        expect(events.filter(e => e.type !== "status")).toHaveLength(0)
      })
    })
  })

  describe("process exit handling", () => {
    beforeEach(async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise
    })

    it("emits exit event with code and signal", () => {
      const exitHandler = vi.fn()
      adapter.on("exit", exitHandler)

      mockProcess.emit("exit", 0, "SIGTERM")

      expect(exitHandler).toHaveBeenCalledWith({ code: 0, signal: "SIGTERM" })
    })

    it("transitions to stopped status on exit", () => {
      mockProcess.emit("exit", 0, null)

      expect(adapter.status).toBe("stopped")
    })

    it("handles null code and signal", () => {
      const exitHandler = vi.fn()
      adapter.on("exit", exitHandler)

      mockProcess.emit("exit", null, null)

      expect(exitHandler).toHaveBeenCalledWith({ code: undefined, signal: undefined })
    })
  })

  describe("custom command", () => {
    it("uses custom command when provided", async () => {
      const customAdapter = new ClaudeAdapter({
        command: "custom-claude",
        spawn: mockSpawn as unknown as SpawnFn,
      })

      const promise = customAdapter.start()
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith("custom-claude", expect.any(Array), expect.any(Object))
    })
  })
})
