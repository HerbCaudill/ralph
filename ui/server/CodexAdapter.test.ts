import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { CodexAdapter, type SpawnFn } from "./CodexAdapter"
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

describe("CodexAdapter", () => {
  let adapter: CodexAdapter
  let mockProcess: ReturnType<typeof createMockProcess>
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockProcess = createMockProcess()
    mockSpawn = vi.fn().mockReturnValue(mockProcess)
    adapter = new CodexAdapter({
      spawn: mockSpawn as unknown as SpawnFn,
    })
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
    it("returns true when codex command succeeds", async () => {
      const versionProcess = createMockProcess()
      mockSpawn.mockReturnValueOnce(versionProcess)

      const promise = adapter.isAvailable()
      versionProcess.emit("exit", 0)

      expect(await promise).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith("codex", ["--version"], expect.any(Object))
    })

    it("returns false when codex command fails", async () => {
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
    it("spawns codex with correct default arguments", async () => {
      const promise = adapter.start()
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "codex",
        ["exec", "--json", "--skip-git-repo-check", "--full-auto"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      )
    })

    it("includes model option when provided", async () => {
      const promise = adapter.start({ model: "o1-preview" })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "codex",
        ["exec", "--json", "--model", "o1-preview", "--skip-git-repo-check", "--full-auto"],
        expect.any(Object),
      )
    })

    it("passes cwd to spawn", async () => {
      const promise = adapter.start({ cwd: "/test/project" })
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        "codex",
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
        "codex",
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
      adapter.send({ type: "user_message", content: "Hello Codex!" })

      expect(mockProcess.stdin.write).toHaveBeenCalledWith("Hello Codex!\n")
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

    describe("thread lifecycle events", () => {
      it("handles thread.started event", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "thread.started",
          thread_id: "019bdcc9-f96c-7413-998b-efbb7a396662",
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        // thread.started doesn't emit a normalized event
        const nonStatusEvents = events.filter(e => e.type !== "status")
        expect(nonStatusEvents).toHaveLength(0)
      })

      it("handles turn.started event", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = { type: "turn.started" }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        // turn.started doesn't emit a normalized event
        const nonStatusEvents = events.filter(e => e.type !== "status")
        expect(nonStatusEvents).toHaveLength(0)
      })
    })

    describe("message events", () => {
      it("translates agent_message item", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "item.completed",
          item: {
            id: "item_0",
            type: "agent_message",
            text: "Hello from Codex!",
          },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
        expect(messageEvents).toHaveLength(1)
        expect(messageEvents[0].content).toBe("Hello from Codex!")
        expect(messageEvents[0].isPartial).toBe(false)
      })

      it("translates reasoning item", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "item.completed",
          item: {
            id: "item_0",
            type: "reasoning",
            text: "**Confirming need for read-only shell command ls**",
          },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
        expect(messageEvents).toHaveLength(1)
        expect(messageEvents[0].content).toBe("**Confirming need for read-only shell command ls**")
      })
    })

    describe("tool use events", () => {
      it("translates command_execution item.started as tool_use", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "item.started",
          item: {
            id: "item_1",
            type: "command_execution",
            command: "/bin/zsh -lc ls",
            aggregated_output: "",
            exit_code: null,
            status: "in_progress",
          },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const toolUseEvents = events.filter(e => e.type === "tool_use") as AgentToolUseEvent[]
        expect(toolUseEvents).toHaveLength(1)
        expect(toolUseEvents[0].toolUseId).toBe("item_1")
        expect(toolUseEvents[0].tool).toBe("bash")
        expect(toolUseEvents[0].input).toEqual({ command: "/bin/zsh -lc ls" })
      })
    })

    describe("tool result events", () => {
      it("translates successful command_execution item.completed", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "item.completed",
          item: {
            id: "item_1",
            type: "command_execution",
            command: "/bin/zsh -lc ls",
            aggregated_output: "file1.txt\nfile2.txt\n",
            exit_code: 0,
            status: "completed",
          },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const resultEvents = events.filter(e => e.type === "tool_result") as AgentToolResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].toolUseId).toBe("item_1")
        expect(resultEvents[0].output).toBe("file1.txt\nfile2.txt\n")
        expect(resultEvents[0].isError).toBe(false)
        expect(resultEvents[0].error).toBeUndefined()
      })

      it("translates failed command_execution item.completed", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const nativeEvent = {
          type: "item.completed",
          item: {
            id: "item_1",
            type: "command_execution",
            command: "/bin/zsh -lc 'ls nonexistent'",
            aggregated_output: "ls: nonexistent: No such file or directory",
            exit_code: 1,
            status: "completed",
          },
        }

        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(nativeEvent) + "\n"))

        const resultEvents = events.filter(e => e.type === "tool_result") as AgentToolResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].isError).toBe(true)
        expect(resultEvents[0].error).toBe("ls: nonexistent: No such file or directory")
        expect(resultEvents[0].output).toBeUndefined()
      })
    })

    describe("result events", () => {
      it("translates turn.completed with accumulated messages", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        // First send a turn.started
        mockProcess.stdout.emit(
          "data",
          Buffer.from(JSON.stringify({ type: "turn.started" }) + "\n"),
        )

        // Then send a message
        const messageEvent = {
          type: "item.completed",
          item: {
            id: "item_0",
            type: "agent_message",
            text: "Task completed",
          },
        }
        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(messageEvent) + "\n"))

        // Then send turn.completed
        const turnCompleted = {
          type: "turn.completed",
          usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 25 },
        }
        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(turnCompleted) + "\n"))

        const resultEvents = events.filter(e => e.type === "result") as AgentResultEvent[]
        expect(resultEvents).toHaveLength(1)
        expect(resultEvents[0].content).toContain("Task completed")
        expect(resultEvents[0].usage).toEqual({
          inputTokens: 150, // input_tokens + cached_input_tokens
          outputTokens: 25,
          totalTokens: 175,
        })
      })

      it("handles turn.completed without messages", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        // Send turn.completed without any preceding messages
        const turnCompleted = {
          type: "turn.completed",
          usage: { input_tokens: 100, output_tokens: 25 },
        }
        mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(turnCompleted) + "\n"))

        // Should not emit a result event if no accumulated message
        const resultEvents = events.filter(e => e.type === "result")
        expect(resultEvents).toHaveLength(0)
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

    describe("buffering", () => {
      it("handles partial JSON across multiple chunks", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const fullJson =
          '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"Hello"}}\n'
        const part1 = fullJson.slice(0, 40)
        const part2 = fullJson.slice(40)

        mockProcess.stdout.emit("data", Buffer.from(part1))
        expect(events.filter(e => e.type === "message")).toHaveLength(0)

        mockProcess.stdout.emit("data", Buffer.from(part2))
        expect(events.filter(e => e.type === "message")).toHaveLength(1)
      })

      it("handles multiple events in single chunk", () => {
        const events: AgentEvent[] = []
        adapter.on("event", e => events.push(e))

        const multipleEvents =
          '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"One"}}\n' +
          '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"Two"}}\n'

        mockProcess.stdout.emit("data", Buffer.from(multipleEvents))

        const messageEvents = events.filter(e => e.type === "message") as AgentMessageEvent[]
        expect(messageEvents).toHaveLength(2)
        expect(messageEvents[0].content).toBe("One")
        expect(messageEvents[1].content).toBe("Two")
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
      const customAdapter = new CodexAdapter({
        command: "custom-codex",
        spawn: mockSpawn as unknown as SpawnFn,
      })

      const promise = customAdapter.start()
      mockProcess.emit("spawn")
      await promise

      expect(mockSpawn).toHaveBeenCalledWith("custom-codex", expect.any(Array), expect.any(Object))
    })
  })
})
