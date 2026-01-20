import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { TaskChatManager, type SpawnFn, type TaskChatMessage } from "./TaskChatManager"
import type { BdProxy, BdIssue } from "./BdProxy"

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

// Create a mock BdProxy
function createMockBdProxy(issues: BdIssue[] = []): BdProxy {
  return {
    list: vi.fn().mockResolvedValue(issues),
    show: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    close: vi.fn(),
    getInfo: vi.fn(),
  } as unknown as BdProxy
}

describe("TaskChatManager", () => {
  let manager: TaskChatManager
  let mockProcess: ReturnType<typeof createMockProcess>
  let mockSpawn: ReturnType<typeof vi.fn>
  let mockBdProxy: BdProxy

  beforeEach(() => {
    mockProcess = createMockProcess()
    mockSpawn = vi.fn().mockReturnValue(mockProcess)
    mockBdProxy = createMockBdProxy()
    manager = new TaskChatManager({
      spawn: mockSpawn as unknown as SpawnFn,
      getBdProxy: () => mockBdProxy,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper to send a message and simulate response
  async function sendAndRespond(
    userMessage: string,
    response: string,
    proc = mockProcess,
  ): Promise<string> {
    const promise = manager.sendMessage(userMessage)

    // Wait for spawn to be called (after async buildSystemPrompt)
    await vi.waitFor(() => {
      expect(mockSpawn).toHaveBeenCalled()
    })

    // Simulate Claude response
    proc.stdout.emit("data", Buffer.from(`{"type":"result","result":"${response}"}\n`))
    proc.emit("exit", 0, null)

    return promise
  }

  describe("initialization", () => {
    it("starts with idle status", () => {
      expect(manager.status).toBe("idle")
      expect(manager.isProcessing).toBe(false)
    })

    it("starts with empty message history", () => {
      expect(manager.messages).toEqual([])
    })

    it("accepts custom options", () => {
      const customManager = new TaskChatManager({
        command: "custom-claude",
        cwd: "/custom/path",
        env: { CUSTOM_VAR: "value" },
        model: "opus",
        spawn: mockSpawn as unknown as SpawnFn,
      })
      expect(customManager.status).toBe("idle")
    })
  })

  describe("sendMessage", () => {
    it("spawns claude process with correct arguments", async () => {
      await sendAndRespond("Hello", "Hi there!")

      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        expect.arrayContaining([
          "--print",
          "--verbose",
          "--output-format",
          "stream-json",
          "--model",
          "haiku",
          "--system-prompt",
          expect.any(String),
          "--tools",
          "",
          "Hello",
        ]),
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      )
    })

    it("transitions to processing status", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const promise = manager.sendMessage("Test")

      // Should be processing immediately
      expect(manager.status).toBe("processing")
      expect(manager.isProcessing).toBe(true)

      // Wait for spawn and complete
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())
      mockProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"Response"}\n'))
      mockProcess.emit("exit", 0, null)
      await promise

      expect(statusChanges).toContain("processing")
      expect(statusChanges).toContain("idle")
    })

    it("adds user message to history immediately", async () => {
      const messages: TaskChatMessage[] = []
      manager.on("message", msg => messages.push(msg))

      const promise = manager.sendMessage("User message")

      // User message should be emitted immediately
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect(messages[0].content).toBe("User message")

      // Complete the request
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())
      mockProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"Response"}\n'))
      mockProcess.emit("exit", 0, null)
      await promise
    })

    it("adds assistant message to history on completion", async () => {
      await sendAndRespond("Hello", "Hi there!")

      const messages = manager.messages
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe("user")
      expect(messages[1].role).toBe("assistant")
      expect(messages[1].content).toBe("Hi there!")
    })

    it("returns the assistant response", async () => {
      const response = await sendAndRespond("Question", "Answer")
      expect(response).toBe("Answer")
    })

    it("throws if already processing", async () => {
      // Start first message - status becomes "processing" immediately
      const firstPromise = manager.sendMessage("First")

      // Second call should reject because status is already "processing"
      await expect(manager.sendMessage("Second")).rejects.toThrow(
        "A request is already in progress",
      )

      // Cleanup - wait for spawn and complete the first message
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())
      mockProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"Done"}\n'))
      mockProcess.emit("exit", 0, null)
      await firstPromise
    })

    it("emits error and rejects on spawn error", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())
      mockProcess.emit("error", new Error("spawn failed"))

      await expect(promise).rejects.toThrow("spawn failed")
      expect(errors).toHaveLength(1)
      expect(manager.status).toBe("error")
    })

    it("rejects on non-zero exit without response", async () => {
      // Need to add error listener to prevent unhandled error event
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      // Create a wrapper that will catch the rejection
      const resultPromise = promise.catch(e => ({ error: e as Error }))

      // Emit exit with error code
      mockProcess.emit("exit", 1, null)

      // Wait for the result
      const result = await resultPromise
      expect(result).toHaveProperty("error")
      expect((result as { error: Error }).error.message).toContain("Claude exited with code 1")
      expect(manager.status).toBe("error")
      expect(errors).toHaveLength(1)
    })
  })

  describe("streaming output parsing", () => {
    it("handles content_block_delta events", async () => {
      const chunks: string[] = []
      manager.on("chunk", text => chunks.push(text))

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      // Simulate streaming deltas
      mockProcess.stdout.emit(
        "data",
        Buffer.from(
          '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n',
        ),
      )
      mockProcess.stdout.emit(
        "data",
        Buffer.from(
          '{"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n',
        ),
      )
      mockProcess.emit("exit", 0, null)

      await promise

      expect(chunks).toEqual(["Hello", " world"])
    })

    it("handles assistant message events", async () => {
      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      mockProcess.stdout.emit(
        "data",
        Buffer.from(
          '{"type":"assistant","message":{"content":[{"type":"text","text":"Full response"}]}}\n',
        ),
      )
      mockProcess.emit("exit", 0, null)

      const response = await promise
      expect(response).toBe("Full response")
    })

    it("handles result events", async () => {
      const response = await sendAndRespond("Test", "Final answer")
      expect(response).toBe("Final answer")
    })

    it("handles multiple events in single chunk", async () => {
      const chunks: string[] = []
      manager.on("chunk", text => chunks.push(text))

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      mockProcess.stdout.emit(
        "data",
        Buffer.from(
          '{"type":"content_block_delta","delta":{"type":"text_delta","text":"A"}}\n' +
            '{"type":"content_block_delta","delta":{"type":"text_delta","text":"B"}}\n',
        ),
      )
      mockProcess.emit("exit", 0, null)

      await promise
      expect(chunks).toEqual(["A", "B"])
    })

    it("handles events split across chunks", async () => {
      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      mockProcess.stdout.emit("data", Buffer.from('{"type":"result","resu'))
      mockProcess.stdout.emit("data", Buffer.from('lt":"Split response"}\n'))
      mockProcess.emit("exit", 0, null)

      const response = await promise
      expect(response).toBe("Split response")
    })

    it("emits error events from Claude", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      mockProcess.stdout.emit("data", Buffer.from('{"type":"error","error":"Rate limited"}\n'))
      mockProcess.emit("exit", 0, null)

      await promise

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("Rate limited")
    })
  })

  describe("conversation history", () => {
    it("includes conversation context for subsequent messages", async () => {
      // First message
      await sendAndRespond("First question", "First answer")

      // Reset mock for second call
      mockSpawn.mockClear()
      const newProcess = createMockProcess()
      mockSpawn.mockReturnValue(newProcess)

      // Second message
      const promise = manager.sendMessage("Follow up")
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())
      newProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"Follow up answer"}\n'))
      newProcess.emit("exit", 0, null)
      await promise

      // Second call should include conversation history in the prompt
      const secondCallArgs = mockSpawn.mock.calls[0][1]
      const promptArg = secondCallArgs[secondCallArgs.length - 1]

      expect(promptArg).toContain("Previous conversation")
      expect(promptArg).toContain("First question")
      expect(promptArg).toContain("First answer")
      expect(promptArg).toContain("Follow up")
    })

    it("preserves messages across multiple exchanges", async () => {
      // First message
      await sendAndRespond("Q1", "A1")

      // Reset mock for second call
      mockSpawn.mockClear()
      const secondProcess = createMockProcess()
      mockSpawn.mockReturnValue(secondProcess)

      // Second message
      const promise = manager.sendMessage("Q2")
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())
      secondProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"A2"}\n'))
      secondProcess.emit("exit", 0, null)
      await promise

      const messages = manager.messages
      expect(messages).toHaveLength(4)
      expect(messages[0]).toMatchObject({ role: "user", content: "Q1" })
      expect(messages[1]).toMatchObject({ role: "assistant", content: "A1" })
      expect(messages[2]).toMatchObject({ role: "user", content: "Q2" })
      expect(messages[3]).toMatchObject({ role: "assistant", content: "A2" })
    })
  })

  describe("clearHistory", () => {
    it("clears all messages", async () => {
      // Add some messages
      await sendAndRespond("Test", "Response")

      expect(manager.messages).toHaveLength(2)

      manager.clearHistory()

      expect(manager.messages).toEqual([])
    })

    it("emits historyCleared event", () => {
      const cleared = vi.fn()
      manager.on("historyCleared", cleared)

      manager.clearHistory()

      expect(cleared).toHaveBeenCalled()
    })
  })

  describe("cancel", () => {
    it("kills the process if processing", async () => {
      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      manager.cancel()

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")
      expect(manager.status).toBe("idle")
      expect(manager.isProcessing).toBe(false)

      // Simulate process exit to clean up
      mockProcess.emit("exit", null, "SIGTERM")

      // The promise may reject or resolve - depends on timing
      try {
        await promise
      } catch {
        // Expected - process was killed
      }
    })

    it("does nothing if not processing", () => {
      manager.cancel()
      // Should not throw
      expect(manager.status).toBe("idle")
    })
  })

  describe("system prompt with task context", () => {
    it("includes task context in system prompt", async () => {
      const issues: BdIssue[] = [
        {
          id: "test-1",
          title: "Open task 1",
          priority: 1,
          status: "open",
          issue_type: "task",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "test-2",
          title: "In progress task",
          priority: 2,
          status: "in_progress",
          issue_type: "task",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      mockBdProxy = createMockBdProxy(issues)
      vi.mocked(mockBdProxy.list).mockImplementation(async opts => {
        if (opts?.status === "open") return [issues[0]]
        if (opts?.status === "in_progress") return [issues[1]]
        return issues
      })

      manager = new TaskChatManager({
        spawn: mockSpawn as unknown as SpawnFn,
        getBdProxy: () => mockBdProxy,
      })

      await sendAndRespond("What tasks do I have?", "You have tasks")

      const spawnArgs = mockSpawn.mock.calls[0][1]
      const systemPromptIndex = spawnArgs.indexOf("--system-prompt") + 1
      const systemPrompt = spawnArgs[systemPromptIndex]

      expect(systemPrompt).toContain("Current Tasks")
      expect(systemPrompt).toContain("In Progress")
      expect(systemPrompt).toContain("test-2")
      expect(systemPrompt).toContain("In progress task")
    })

    it("continues without task context if BdProxy fails", async () => {
      mockBdProxy = createMockBdProxy()
      vi.mocked(mockBdProxy.list).mockRejectedValue(new Error("DB error"))

      manager = new TaskChatManager({
        spawn: mockSpawn as unknown as SpawnFn,
        getBdProxy: () => mockBdProxy,
      })

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      await sendAndRespond("Test", "Response")

      // Should still work
      expect(manager.messages).toHaveLength(2)

      consoleSpy.mockRestore()
    })

    it("works without getBdProxy function", async () => {
      manager = new TaskChatManager({
        spawn: mockSpawn as unknown as SpawnFn,
        // No getBdProxy provided
      })

      await sendAndRespond("Test", "Response")

      expect(manager.messages).toHaveLength(2)
    })
  })

  describe("stderr handling", () => {
    it("logs stderr but does not fail", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      mockProcess.stderr.emit("data", Buffer.from("Warning message"))
      mockProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"Response"}\n'))
      mockProcess.emit("exit", 0, null)

      await promise

      expect(consoleSpy).toHaveBeenCalledWith("[task-chat] stderr:", "Warning message")
      expect(manager.messages).toHaveLength(2)

      consoleSpy.mockRestore()
    })
  })

  describe("events", () => {
    it("emits event for each parsed JSON line", async () => {
      const events: unknown[] = []
      manager.on("event", evt => events.push(evt))

      const promise = manager.sendMessage("Test")

      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalled())

      mockProcess.stdout.emit("data", Buffer.from('{"type":"custom","data":123}\n'))
      mockProcess.stdout.emit("data", Buffer.from('{"type":"result","result":"Done"}\n'))
      mockProcess.emit("exit", 0, null)

      await promise

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({ type: "custom", data: 123 })
      expect(events[1]).toMatchObject({ type: "result", result: "Done" })
    })
  })
})
