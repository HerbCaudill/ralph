import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { TaskChatManager, type TaskChatMessage } from "./TaskChatManager"
import type { BdProxy, BdIssue } from "./BdProxy"
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"

// Mock the Claude Agent SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}))

// Import the mocked query function
import { query as mockQuery } from "@anthropic-ai/claude-agent-sdk"

// Create a mock SDK response generator
async function* createMockSDKResponse(text: string): AsyncGenerator<SDKMessage> {
  // Emit streaming deltas
  for (const char of text) {
    yield {
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: char },
      },
    } as SDKMessage
  }

  // Emit final result
  yield {
    type: "result",
    subtype: "success",
    result: text,
  } as SDKMessage
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
  let mockBdProxy: BdProxy

  beforeEach(() => {
    mockBdProxy = createMockBdProxy()
    manager = new TaskChatManager({
      getBdProxy: () => mockBdProxy,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper to send a message and simulate response
  async function sendAndRespond(userMessage: string, response: string): Promise<string> {
    // Mock the SDK query function to return our mock response
    vi.mocked(mockQuery).mockReturnValueOnce(createMockSDKResponse(response) as any)

    const promise = manager.sendMessage(userMessage)

    // Wait a bit for the async operation to start
    await new Promise(resolve => setTimeout(resolve, 10))

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
        cwd: "/custom/path",
        env: { CUSTOM_VAR: "value" },
        model: "opus",
      })
      expect(customManager.status).toBe("idle")
    })
  })

  describe("sendMessage", () => {
    it("calls SDK query with correct options", async () => {
      await sendAndRespond("Hello", "Hi there!")

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: "Hello",
        options: expect.objectContaining({
          model: "haiku",
          // Uses Claude Code's preset with appended task chat instructions
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: expect.any(String),
          },
          tools: ["Read", "Grep", "Glob", "Bash"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          includePartialMessages: true,
          maxTurns: 30,
        }),
      })
    })

    it("transitions to processing status", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      // Mock SDK response
      vi.mocked(mockQuery).mockReturnValueOnce(createMockSDKResponse("Response") as any)

      const promise = manager.sendMessage("Test")

      // Should be processing immediately
      expect(manager.status).toBe("processing")
      expect(manager.isProcessing).toBe(true)

      // Wait for completion
      await promise

      expect(statusChanges).toContain("processing")
      expect(statusChanges).toContain("idle")
    })

    it("adds user message to history immediately", async () => {
      const messages: TaskChatMessage[] = []
      manager.on("message", msg => messages.push(msg))

      // Mock SDK response
      vi.mocked(mockQuery).mockReturnValueOnce(createMockSDKResponse("Response") as any)

      const promise = manager.sendMessage("User message")

      // User message should be emitted immediately
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect(messages[0].content).toBe("User message")

      // Complete the request
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
      // Mock SDK response for first message
      vi.mocked(mockQuery).mockReturnValueOnce(createMockSDKResponse("Done") as any)

      // Start first message - status becomes "processing" immediately
      const firstPromise = manager.sendMessage("First")

      // Second call should reject because status is already "processing"
      await expect(manager.sendMessage("Second")).rejects.toThrow(
        "A request is already in progress",
      )

      // Cleanup - complete the first message
      await firstPromise
    })

    it("emits error and rejects on SDK error", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      // Mock SDK to throw an error
      async function* errorGenerator() {
        throw new Error("SDK query failed")
      }
      vi.mocked(mockQuery).mockReturnValueOnce(errorGenerator() as any)

      const promise = manager.sendMessage("Test")

      await expect(promise).rejects.toThrow("SDK query failed")
      expect(errors).toHaveLength(1)
      expect(manager.status).toBe("error")
    })

    it("rejects on SDK result error", async () => {
      // Need to add error listener to prevent unhandled error event
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      // Mock SDK to return error result
      async function* errorResultGenerator(): AsyncGenerator<SDKMessage> {
        yield {
          type: "result",
          subtype: "error_during_execution",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(errorResultGenerator() as any)

      // Create a wrapper that will catch the rejection
      const promise = manager.sendMessage("Test")
      const resultPromise = promise.catch(e => ({ error: e as Error }))

      // Wait for the result
      const result = await resultPromise
      expect(result).toHaveProperty("error")
      expect((result as { error: Error }).error.message).toContain("Query failed:")
      expect(errors).toHaveLength(1)
    })
  })

  describe("streaming output parsing", () => {
    it("handles content_block_delta events", async () => {
      const chunks: string[] = []
      manager.on("chunk", text => chunks.push(text))

      // Mock SDK response with streaming deltas
      async function* streamingResponse(): AsyncGenerator<SDKMessage> {
        yield {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          },
        } as SDKMessage
        yield {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: " world" },
          },
        } as SDKMessage
        yield {
          type: "result",
          subtype: "success",
          result: "Hello world",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(streamingResponse() as any)

      const promise = manager.sendMessage("Test")

      await promise

      expect(chunks).toEqual(["Hello", " world"])
    })

    it("handles assistant message events", async () => {
      // Mock SDK response with assistant message
      async function* assistantResponse(): AsyncGenerator<SDKMessage> {
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Full response" }],
          },
        } as SDKMessage
        yield {
          type: "result",
          subtype: "success",
          result: "Full response",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(assistantResponse() as any)

      const promise = manager.sendMessage("Test")

      const response = await promise
      expect(response).toBe("Full response")
    })

    it("handles result events", async () => {
      const response = await sendAndRespond("Test", "Final answer")
      expect(response).toBe("Final answer")
    })

    it("handles multiple streaming events", async () => {
      const chunks: string[] = []
      manager.on("chunk", text => chunks.push(text))

      // Mock SDK response with multiple deltas
      async function* multipleEventsResponse(): AsyncGenerator<SDKMessage> {
        yield {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "A" },
          },
        } as SDKMessage
        yield {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "B" },
          },
        } as SDKMessage
        yield {
          type: "result",
          subtype: "success",
          result: "AB",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(multipleEventsResponse() as any)

      const promise = manager.sendMessage("Test")

      await promise
      expect(chunks).toEqual(["A", "B"])
    })

    it("handles result message correctly", async () => {
      // This test is effectively the same as using sendAndRespond
      const response = await sendAndRespond("Test", "Split response")
      expect(response).toBe("Split response")
    })

    it("emits error events from SDK error result", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      // Mock SDK response with error result
      async function* errorResponse(): AsyncGenerator<SDKMessage> {
        yield {
          type: "result",
          subtype: "error_during_execution",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(errorResponse() as any)

      const promise = manager.sendMessage("Test")

      // Promise will reject but error event should be emitted
      await promise.catch(() => {})

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("Query failed:")
    })
  })

  describe("conversation history", () => {
    it("includes conversation context for subsequent messages", async () => {
      // First message
      await sendAndRespond("First question", "First answer")

      // Clear mock for second call
      vi.mocked(mockQuery).mockClear()

      // Second message
      await sendAndRespond("Follow up", "Follow up answer")

      // Second call should include conversation history in the prompt
      expect(mockQuery).toHaveBeenCalledTimes(1)
      const secondCallArgs = vi.mocked(mockQuery).mock.calls[0][0]
      const promptArg = secondCallArgs.prompt

      expect(promptArg).toContain("Previous conversation")
      expect(promptArg).toContain("First question")
      expect(promptArg).toContain("First answer")
      expect(promptArg).toContain("Follow up")
    })

    it("preserves messages across multiple exchanges", async () => {
      // First message
      await sendAndRespond("Q1", "A1")

      // Second message
      await sendAndRespond("Q2", "A2")

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
    it("aborts the SDK query if processing", async () => {
      // Create a long-running generator that we can interrupt
      async function* longRunningResponse(): AsyncGenerator<SDKMessage> {
        // Yield some chunks
        for (let i = 0; i < 100; i++) {
          yield {
            type: "stream_event",
            event: {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "x" },
            },
          } as SDKMessage
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(longRunningResponse() as any)

      const promise = manager.sendMessage("Test")

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 20))

      manager.cancel()

      expect(manager.status).toBe("idle")
      expect(manager.isProcessing).toBe(false)

      // The promise should resolve with partial response
      const result = await promise
      // Since we cancelled, we might get a partial response
      expect(typeof result).toBe("string")
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
        getBdProxy: () => mockBdProxy,
      })

      await sendAndRespond("What tasks do I have?", "You have tasks")

      // Check that SDK query was called with system prompt containing task context
      expect(mockQuery).toHaveBeenCalled()
      const callArgs = vi.mocked(mockQuery).mock.calls[0][0]
      const systemPromptConfig = callArgs.options?.systemPrompt as {
        type: string
        preset: string
        append: string
      }

      // Verify it uses the preset format
      expect(systemPromptConfig.type).toBe("preset")
      expect(systemPromptConfig.preset).toBe("claude_code")

      // Check that the appended prompt contains task context
      expect(systemPromptConfig.append).toContain("Current Tasks")
      expect(systemPromptConfig.append).toContain("In Progress")
      expect(systemPromptConfig.append).toContain("test-2")
      expect(systemPromptConfig.append).toContain("In progress task")
    })

    it("continues without task context if BdProxy fails", async () => {
      mockBdProxy = createMockBdProxy()
      vi.mocked(mockBdProxy.list).mockRejectedValue(new Error("DB error"))

      manager = new TaskChatManager({
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
        // No getBdProxy provided
      })

      await sendAndRespond("Test", "Response")

      expect(manager.messages).toHaveLength(2)
    })
  })

  describe("stderr handling", () => {
    it("SDK handles errors internally (no stderr to test)", async () => {
      // With SDK, we don't have direct stderr access
      // Errors are handled through the SDK's error messages
      const response = await sendAndRespond("Test", "Response")
      expect(manager.messages).toHaveLength(2)
      expect(response).toBe("Response")
    })
  })

  describe("events", () => {
    it("emits event for SDK messages", async () => {
      const events: unknown[] = []
      manager.on("event", evt => events.push(evt))

      // Mock SDK response with multiple message types
      async function* customResponse(): AsyncGenerator<SDKMessage> {
        yield {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Done" },
          },
        } as SDKMessage
        yield {
          type: "result",
          subtype: "success",
          result: "Done",
        } as SDKMessage
      }
      vi.mocked(mockQuery).mockReturnValueOnce(customResponse() as any)

      const promise = manager.sendMessage("Test")

      await promise

      // Should have emitted events for the SDK messages
      expect(events.length).toBeGreaterThan(0)
      expect(events.some(e => (e as any).type === "content_block_delta")).toBe(true)
      expect(events.some(e => (e as any).type === "result")).toBe(true)
    })
  })

  describe("timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("defaults to 10 minute timeout", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      // Mock an SDK query that never completes
      async function* neverEndingResponse(): AsyncGenerator<SDKMessage> {
        // This generator will never yield, simulating a stuck request
        await new Promise(() => {}) // Never resolves
      }
      vi.mocked(mockQuery).mockReturnValueOnce(neverEndingResponse() as any)

      const promise = manager.sendMessage("Test").catch(e => e)

      // Advance time by 10 minutes
      await vi.advanceTimersByTimeAsync(600000)

      const result = await promise
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toContain("Request timed out after 10 minutes")
      expect(manager.status).toBe("idle")
    })

    it("accepts custom timeout option", async () => {
      const customManager = new TaskChatManager({
        getBdProxy: () => mockBdProxy,
        timeout: 60000, // 1 minute
      })

      const errors: Error[] = []
      customManager.on("error", err => errors.push(err))

      // Mock an SDK query that never completes
      async function* neverEndingResponse(): AsyncGenerator<SDKMessage> {
        await new Promise(() => {}) // Never resolves
      }
      vi.mocked(mockQuery).mockReturnValueOnce(neverEndingResponse() as any)

      const promise = customManager.sendMessage("Test").catch(e => e)

      // 30 seconds should not trigger timeout
      await vi.advanceTimersByTimeAsync(30000)

      // 1 minute should trigger timeout
      await vi.advanceTimersByTimeAsync(30000)

      const result = await promise
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toContain("Request timed out after 1 minutes")
    })

    it("clears timeout on successful completion", async () => {
      vi.mocked(mockQuery).mockReturnValueOnce(createMockSDKResponse("Done") as any)

      const promise = manager.sendMessage("Test")

      // Wait for promise to resolve
      await promise

      // Advance time past the timeout - should not cause issues
      await vi.advanceTimersByTimeAsync(700000)

      // Should still be idle, not errored
      expect(manager.status).toBe("idle")
    })
  })
})
