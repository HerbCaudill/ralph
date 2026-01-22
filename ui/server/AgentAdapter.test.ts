import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  AgentAdapter,
  type AgentEvent,
  type AgentInfo,
  type AgentMessage,
  type AgentStartOptions,
  type AgentStatus,
  type AgentMessageEvent,
  type AgentToolUseEvent,
  type AgentToolResultEvent,
  type AgentResultEvent,
  type AgentErrorEvent,
  type AgentStatusEvent,
  isAgentMessageEvent,
  isAgentToolUseEvent,
  isAgentToolResultEvent,
  isAgentResultEvent,
  isAgentErrorEvent,
  isAgentStatusEvent,
} from "./AgentAdapter"

/**
 * Test implementation of AgentAdapter for unit testing.
 */
class TestAdapter extends AgentAdapter {
  public startCalls: AgentStartOptions[] = []
  public sendCalls: AgentMessage[] = []
  public stopCalls: boolean[] = []
  private _isAvailable = true

  /**
   * Set the availability status of this test adapter.
   */
  setAvailable(
    /** Whether the adapter should be available */
    value: boolean,
  ) {
    this._isAvailable = value
  }

  /**
   * Get information about this test adapter.
   */
  getInfo(): AgentInfo {
    return {
      id: "test",
      name: "Test Agent",
      description: "A test agent for unit testing",
      version: "1.0.0",
      features: {
        streaming: true,
        tools: true,
        pauseResume: true,
        systemPrompt: true,
      },
    }
  }

  /**
   * Check if this test adapter is available.
   */
  async isAvailable(): Promise<boolean> {
    return this._isAvailable
  }

  /**
   * Start the test adapter and record the call.
   */
  async start(
    /** Start options */
    options?: AgentStartOptions,
  ): Promise<void> {
    this.startCalls.push(options ?? {})
    this.setStatus("starting")
    // Simulate async start
    await Promise.resolve()
    this.setStatus("running")
  }

  /**
   * Send a message to the test adapter and record the call.
   */
  send(
    /** The message to send */
    message: AgentMessage,
  ): void {
    this.sendCalls.push(message)
  }

  /**
   * Stop the test adapter and record the call.
   */
  async stop(
    /** Whether to force stop */
    force?: boolean,
  ): Promise<void> {
    this.stopCalls.push(force ?? false)
    this.setStatus("stopping")
    await Promise.resolve()
    this.setStatus("stopped")
  }

  /**
   * Expose setStatus for testing purposes.
   */
  public testSetStatus(
    /** The status to set */
    status: AgentStatus,
  ) {
    this.setStatus(status)
  }

  /**
   * Expose event emission for testing purposes.
   */
  public testEmitEvent(
    /** The event to emit */
    event: AgentEvent,
  ) {
    this.emit("event", event)
  }
}

describe("AgentAdapter", () => {
  let adapter: TestAdapter

  beforeEach(() => {
    adapter = new TestAdapter()
  })

  describe("status management", () => {
    it("starts with idle status", () => {
      expect(adapter.status).toBe("idle")
    })

    it("reports isRunning correctly", () => {
      expect(adapter.isRunning).toBe(false)
      adapter.testSetStatus("running")
      expect(adapter.isRunning).toBe(true)
      adapter.testSetStatus("paused")
      expect(adapter.isRunning).toBe(false)
    })

    it("emits status event when status changes", () => {
      const statusHandler = vi.fn()
      adapter.on("status", statusHandler)

      adapter.testSetStatus("starting")
      expect(statusHandler).toHaveBeenCalledWith("starting")
      expect(statusHandler).toHaveBeenCalledTimes(1)
    })

    it("emits normalized status event when status changes", () => {
      const eventHandler = vi.fn()
      adapter.on("event", eventHandler)

      adapter.testSetStatus("running")

      expect(eventHandler).toHaveBeenCalled()
      const emittedEvent = eventHandler.mock.calls[0][0] as AgentStatusEvent
      expect(emittedEvent.type).toBe("status")
      expect(emittedEvent.status).toBe("running")
      expect(emittedEvent.timestamp).toBeGreaterThan(0)
    })

    it("does not emit status event when status unchanged", () => {
      adapter.testSetStatus("running")

      const statusHandler = vi.fn()
      adapter.on("status", statusHandler)

      adapter.testSetStatus("running") // Same status
      expect(statusHandler).not.toHaveBeenCalled()
    })
  })

  describe("getInfo", () => {
    it("returns agent info", () => {
      const info = adapter.getInfo()
      expect(info.id).toBe("test")
      expect(info.name).toBe("Test Agent")
      expect(info.features.streaming).toBe(true)
      expect(info.features.tools).toBe(true)
    })
  })

  describe("isAvailable", () => {
    it("returns true when available", async () => {
      expect(await adapter.isAvailable()).toBe(true)
    })

    it("returns false when unavailable", async () => {
      adapter.setAvailable(false)
      expect(await adapter.isAvailable()).toBe(false)
    })
  })

  describe("start", () => {
    it("starts the adapter and transitions through statuses", async () => {
      const statuses: AgentStatus[] = []
      adapter.on("status", s => statuses.push(s))

      await adapter.start()

      expect(statuses).toEqual(["starting", "running"])
      expect(adapter.status).toBe("running")
    })

    it("passes options to implementation", async () => {
      const options: AgentStartOptions = {
        cwd: "/test",
        model: "haiku",
        systemPrompt: "Test prompt",
      }

      await adapter.start(options)

      expect(adapter.startCalls).toHaveLength(1)
      expect(adapter.startCalls[0]).toEqual(options)
    })
  })

  describe("send", () => {
    it("sends user messages", () => {
      const message: AgentMessage = {
        type: "user_message",
        content: "Hello, agent!",
      }

      adapter.send(message)

      expect(adapter.sendCalls).toHaveLength(1)
      expect(adapter.sendCalls[0]).toEqual(message)
    })

    it("sends control messages", () => {
      const message: AgentMessage = {
        type: "control",
        command: "pause",
      }

      adapter.send(message)

      expect(adapter.sendCalls[0]).toEqual(message)
    })
  })

  describe("stop", () => {
    it("stops the adapter and transitions to stopped", async () => {
      await adapter.start()

      const statuses: AgentStatus[] = []
      adapter.on("status", s => statuses.push(s))

      await adapter.stop()

      expect(statuses).toEqual(["stopping", "stopped"])
      expect(adapter.status).toBe("stopped")
    })

    it("passes force flag", async () => {
      await adapter.start()
      await adapter.stop(true)

      expect(adapter.stopCalls).toContain(true)
    })
  })

  describe("event emission", () => {
    it("can emit message events", () => {
      const eventHandler = vi.fn()
      adapter.on("event", eventHandler)

      const messageEvent: AgentMessageEvent = {
        type: "message",
        timestamp: Date.now(),
        content: "Hello!",
      }

      adapter.testEmitEvent(messageEvent)

      expect(eventHandler).toHaveBeenCalledWith(messageEvent)
    })

    it("can emit tool use events", () => {
      const eventHandler = vi.fn()
      adapter.on("event", eventHandler)

      const toolUseEvent: AgentToolUseEvent = {
        type: "tool_use",
        timestamp: Date.now(),
        toolUseId: "tool-123",
        tool: "Read",
        input: { file_path: "/test.txt" },
      }

      adapter.testEmitEvent(toolUseEvent)

      expect(eventHandler).toHaveBeenCalledWith(toolUseEvent)
    })

    it("can emit tool result events", () => {
      const eventHandler = vi.fn()
      adapter.on("event", eventHandler)

      const toolResultEvent: AgentToolResultEvent = {
        type: "tool_result",
        timestamp: Date.now(),
        toolUseId: "tool-123",
        output: "File contents here",
        isError: false,
      }

      adapter.testEmitEvent(toolResultEvent)

      expect(eventHandler).toHaveBeenCalledWith(toolResultEvent)
    })

    it("can emit result events", () => {
      const eventHandler = vi.fn()
      adapter.on("event", eventHandler)

      const resultEvent: AgentResultEvent = {
        type: "result",
        timestamp: Date.now(),
        content: "Task completed successfully",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }

      adapter.testEmitEvent(resultEvent)

      expect(eventHandler).toHaveBeenCalledWith(resultEvent)
    })

    it("can emit error events", () => {
      const eventHandler = vi.fn()
      adapter.on("event", eventHandler)

      const errorEvent: AgentErrorEvent = {
        type: "error",
        timestamp: Date.now(),
        message: "Something went wrong",
        code: "ERR_TIMEOUT",
        fatal: false,
      }

      adapter.testEmitEvent(errorEvent)

      expect(eventHandler).toHaveBeenCalledWith(errorEvent)
    })
  })
})

describe("Type Guards", () => {
  const now = Date.now()

  describe("isAgentMessageEvent", () => {
    it("returns true for message events", () => {
      const event: AgentMessageEvent = { type: "message", timestamp: now, content: "Hi" }
      expect(isAgentMessageEvent(event)).toBe(true)
    })

    it("returns false for other events", () => {
      const event: AgentErrorEvent = { type: "error", timestamp: now, message: "Err", fatal: false }
      expect(isAgentMessageEvent(event)).toBe(false)
    })
  })

  describe("isAgentToolUseEvent", () => {
    it("returns true for tool_use events", () => {
      const event: AgentToolUseEvent = {
        type: "tool_use",
        timestamp: now,
        toolUseId: "123",
        tool: "Read",
        input: {},
      }
      expect(isAgentToolUseEvent(event)).toBe(true)
    })

    it("returns false for other events", () => {
      const event: AgentMessageEvent = { type: "message", timestamp: now, content: "Hi" }
      expect(isAgentToolUseEvent(event)).toBe(false)
    })
  })

  describe("isAgentToolResultEvent", () => {
    it("returns true for tool_result events", () => {
      const event: AgentToolResultEvent = {
        type: "tool_result",
        timestamp: now,
        toolUseId: "123",
        isError: false,
      }
      expect(isAgentToolResultEvent(event)).toBe(true)
    })

    it("returns false for other events", () => {
      const event: AgentToolUseEvent = {
        type: "tool_use",
        timestamp: now,
        toolUseId: "123",
        tool: "Read",
        input: {},
      }
      expect(isAgentToolResultEvent(event)).toBe(false)
    })
  })

  describe("isAgentResultEvent", () => {
    it("returns true for result events", () => {
      const event: AgentResultEvent = { type: "result", timestamp: now, content: "Done" }
      expect(isAgentResultEvent(event)).toBe(true)
    })

    it("returns false for other events", () => {
      const event: AgentMessageEvent = { type: "message", timestamp: now, content: "Hi" }
      expect(isAgentResultEvent(event)).toBe(false)
    })
  })

  describe("isAgentErrorEvent", () => {
    it("returns true for error events", () => {
      const event: AgentErrorEvent = {
        type: "error",
        timestamp: now,
        message: "Err",
        fatal: true,
      }
      expect(isAgentErrorEvent(event)).toBe(true)
    })

    it("returns false for other events", () => {
      const event: AgentResultEvent = { type: "result", timestamp: now, content: "Done" }
      expect(isAgentErrorEvent(event)).toBe(false)
    })
  })

  describe("isAgentStatusEvent", () => {
    it("returns true for status events", () => {
      const event: AgentStatusEvent = { type: "status", timestamp: now, status: "running" }
      expect(isAgentStatusEvent(event)).toBe(true)
    })

    it("returns false for other events", () => {
      const event: AgentMessageEvent = { type: "message", timestamp: now, content: "Hi" }
      expect(isAgentStatusEvent(event)).toBe(false)
    })
  })
})

describe("AgentEvent type coverage", () => {
  // These tests ensure all event types have the required properties
  const now = Date.now()

  it("AgentMessageEvent has required properties", () => {
    const event: AgentMessageEvent = {
      type: "message",
      timestamp: now,
      content: "Hello",
      isPartial: true,
      id: "msg-1",
    }
    expect(event.type).toBe("message")
    expect(event.content).toBe("Hello")
    expect(event.isPartial).toBe(true)
  })

  it("AgentToolUseEvent has required properties", () => {
    const event: AgentToolUseEvent = {
      type: "tool_use",
      timestamp: now,
      toolUseId: "tool-1",
      tool: "Bash",
      input: { command: "ls" },
    }
    expect(event.type).toBe("tool_use")
    expect(event.toolUseId).toBe("tool-1")
    expect(event.tool).toBe("Bash")
    expect(event.input).toEqual({ command: "ls" })
  })

  it("AgentToolResultEvent has required properties", () => {
    const successEvent: AgentToolResultEvent = {
      type: "tool_result",
      timestamp: now,
      toolUseId: "tool-1",
      output: "file1.txt\nfile2.txt",
      isError: false,
    }
    expect(successEvent.type).toBe("tool_result")
    expect(successEvent.output).toBe("file1.txt\nfile2.txt")
    expect(successEvent.isError).toBe(false)

    const errorEvent: AgentToolResultEvent = {
      type: "tool_result",
      timestamp: now,
      toolUseId: "tool-2",
      error: "File not found",
      isError: true,
    }
    expect(errorEvent.isError).toBe(true)
    expect(errorEvent.error).toBe("File not found")
  })

  it("AgentResultEvent has required properties", () => {
    const event: AgentResultEvent = {
      type: "result",
      timestamp: now,
      content: "Task completed",
      exitCode: 0,
      usage: {
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
      },
    }
    expect(event.type).toBe("result")
    expect(event.content).toBe("Task completed")
    expect(event.exitCode).toBe(0)
    expect(event.usage?.totalTokens).toBe(700)
  })

  it("AgentErrorEvent has required properties", () => {
    const event: AgentErrorEvent = {
      type: "error",
      timestamp: now,
      message: "Rate limit exceeded",
      code: "RATE_LIMIT",
      fatal: false,
    }
    expect(event.type).toBe("error")
    expect(event.message).toBe("Rate limit exceeded")
    expect(event.code).toBe("RATE_LIMIT")
    expect(event.fatal).toBe(false)
  })

  it("AgentStatusEvent has required properties", () => {
    const event: AgentStatusEvent = {
      type: "status",
      timestamp: now,
      status: "paused",
    }
    expect(event.type).toBe("status")
    expect(event.status).toBe("paused")
  })
})
