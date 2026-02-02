import { describe, it, expect } from "vitest"
import { createCodexAdapter } from ".././createCodexAdapter"
import type { AgentAdapter, ChatEvent } from "@herbcaudill/agent-view"

/**
 * Integration tests demonstrating how agent-view-codex connects to agent-view.
 *
 * These tests verify the full pipeline: native Codex SDK events → adapter → ChatEvent[]
 * suitable for passing to `<AgentView events={events} />`.
 */
describe("agent-view + agent-view-codex integration", () => {
  /** Create the adapter once — same as a consumer would. */
  const adapter: AgentAdapter = createCodexAdapter()

  it("adapter satisfies the AgentAdapter interface", () => {
    expect(adapter.meta.name).toBe("codex")
    expect(adapter.meta.displayName).toBe("Codex")
    expect(typeof adapter.convertEvent).toBe("function")
    expect(typeof adapter.convertEvents).toBe("function")
  })

  it("converts a realistic Codex session into ChatEvents", () => {
    // Simulated stream of native Codex thread events
    const nativeEvents = [
      // 1. Thread starts (filtered out)
      { type: "thread.started" },

      // 2. Turn starts (filtered out)
      { type: "turn.started" },

      // 3. Codex thinks about the problem
      {
        type: "item.completed",
        item: {
          type: "reasoning",
          id: "reasoning-1",
          text: "I need to check the test file to understand the failure.",
        },
      },

      // 4. Codex writes a message
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          id: "msg-1",
          text: "Let me run the tests to see what's failing.",
        },
      },

      // 5. Command starts (running state)
      {
        type: "item.started",
        item: {
          type: "command_execution",
          id: "cmd-1",
          command: "pnpm test",
        },
      },

      // 6. Streaming output
      {
        type: "item.updated",
        item: {
          type: "command_execution",
          id: "cmd-1",
          command: "pnpm test",
          aggregated_output: "Running tests...\n",
        },
      },

      // 7. Command completes
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-1",
          command: "pnpm test",
          aggregated_output: "✓ All 45 tests passed\n",
          exit_code: 0,
        },
      },

      // 8. File edit
      {
        type: "item.completed",
        item: {
          type: "file_change",
          id: "file-1",
          changes: [{ kind: "edit", path: "/src/index.ts" }],
          status: "completed",
        },
      },

      // 9. Turn completes with usage
      {
        type: "turn.completed",
        usage: {
          input_tokens: 800,
          cached_input_tokens: 200,
          output_tokens: 150,
        },
      },
    ]

    const chatEvents = adapter.convertEvents(nativeEvents)

    // thread.started and turn.started are filtered out
    expect(chatEvents).toHaveLength(7)

    // Every ChatEvent has a type; Codex events don't carry timestamps
    for (const event of chatEvents) {
      expect(event.type).toBeDefined()
      expect(event.timestamp).toBeUndefined()
    }

    // Verify event types in order
    expect(chatEvents.map(e => e.type)).toEqual([
      "assistant", // reasoning → thinking content block inside assistant
      "assistant", // agent_message
      "tool_use", // command started (running)
      "tool_use", // command streaming output
      "tool_use", // command completed (success)
      "tool_use", // file change
      "result", // turn completed with usage
    ])
  })

  it("maps Codex tool types to ChatEvent tool names", () => {
    const commandExec = {
      type: "item.completed",
      item: {
        type: "command_execution",
        id: "cmd-1",
        command: "ls -la",
        aggregated_output: "total 42\n",
        exit_code: 0,
      },
    }

    const fileChange = {
      type: "item.completed",
      item: {
        type: "file_change",
        id: "file-1",
        changes: [{ kind: "edit", path: "/foo.ts" }],
        status: "completed",
      },
    }

    const mcpCall = {
      type: "item.completed",
      item: {
        type: "mcp_tool_call",
        id: "mcp-1",
        server: "test",
        tool: "read_file",
        arguments: { path: "/foo.ts" },
        status: "completed",
        result: { content: "file content" },
      },
    }

    const events = adapter.convertEvents([commandExec, fileChange, mcpCall])

    // Codex types map to standard tool names
    expect((events[0] as any).tool).toBe("Bash") // command_execution → Bash
    expect((events[1] as any).tool).toBe("Edit") // file_change → Edit
    expect((events[2] as any).tool).toBe("Task") // mcp_tool_call → Task
  })

  it("tracks command execution lifecycle: started → streaming → completed", () => {
    const events = [
      {
        type: "item.started",
        item: { type: "command_execution", id: "cmd-1", command: "npm install" },
      },
      {
        type: "item.updated",
        item: {
          type: "command_execution",
          id: "cmd-1",
          command: "npm install",
          aggregated_output: "Installing...",
        },
      },
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-1",
          command: "npm install",
          aggregated_output: "Done in 2.3s",
          exit_code: 0,
        },
      },
    ]

    const chatEvents = adapter.convertEvents(events)

    expect(chatEvents).toHaveLength(3)

    // All share the same tool and id
    for (const event of chatEvents) {
      expect((event as any).tool).toBe("Bash")
      expect((event as any).id).toBe("cmd-1")
    }

    // Status progresses through lifecycle
    expect((chatEvents[0] as any).status).toBe("running")
    expect((chatEvents[1] as any).status).toBe("running")
    expect((chatEvents[2] as any).status).toBe("success")
  })

  it("converts thinking/reasoning into assistant events with thinking content blocks", () => {
    const event = {
      type: "item.completed",
      item: {
        type: "reasoning",
        id: "reasoning-1",
        text: "I should check the error logs first.",
      },
    }

    const [chatEvent] = adapter.convertEvent(event)

    expect(chatEvent.type).toBe("assistant")
    const content = (chatEvent as any).message.content
    expect(content).toHaveLength(1)
    expect(content[0].type).toBe("thinking")
    expect(content[0].thinking).toBe("I should check the error logs first.")
  })

  it("normalizes Codex token usage (including cached tokens)", () => {
    const event = {
      type: "turn.completed",
      usage: {
        input_tokens: 1000,
        cached_input_tokens: 300,
        output_tokens: 200,
      },
    }

    const [chatEvent] = adapter.convertEvent(event)
    const usage = (chatEvent as any).usage

    // Codex adds cached tokens to input tokens
    expect(usage.inputTokens).toBe(1300)
    expect(usage.outputTokens).toBe(200)

    // Both naming conventions available
    expect(usage.input_tokens).toBe(1300)
    expect(usage.output_tokens).toBe(200)
  })

  it("filters out Codex noise events (thread.started, turn.started)", () => {
    const events = [
      { type: "thread.started" },
      { type: "turn.started" },
      { type: "item.completed", item: { type: "agent_message", id: "msg-1", text: "Hi" } },
    ]

    const chatEvents = adapter.convertEvents(events)

    expect(chatEvents).toHaveLength(1)
    expect(chatEvents[0].type).toBe("assistant")
  })

  it("handles error events from different sources", () => {
    const events = [
      // Top-level error
      { type: "error", message: "API error" },

      // Turn failure
      { type: "turn.failed", error: { message: "Context exceeded" } },

      // Failed command
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          id: "cmd-1",
          command: "false",
          exit_code: 1,
          aggregated_output: "command not found",
        },
      },

      // Error item
      {
        type: "item.completed",
        item: { type: "error", id: "err-1", message: "Something broke" },
      },
    ]

    const chatEvents = adapter.convertEvents(events)

    expect(chatEvents).toHaveLength(4)

    // Different error representations
    expect(chatEvents[0].type).toBe("error")
    expect((chatEvents[0] as any).error).toBe("API error")

    expect(chatEvents[1].type).toBe("error")
    expect((chatEvents[1] as any).error).toBe("Context exceeded")

    expect(chatEvents[2].type).toBe("tool_use")
    expect((chatEvents[2] as any).status).toBe("error")
    expect((chatEvents[2] as any).error).toBe("command not found")

    expect(chatEvents[3].type).toBe("error")
    expect((chatEvents[3] as any).error).toBe("Something broke")
  })

  it("produces events compatible with ChatEvent interface", () => {
    const nativeEvent = {
      type: "item.completed",
      item: { type: "agent_message", id: "msg-1", text: "Hello" },
    }

    const [chatEvent] = adapter.convertEvent(nativeEvent)

    // ChatEvent requires type; timestamp is undefined for Codex events
    const typed: ChatEvent = chatEvent
    expect(typed.type).toBe("assistant")
    expect(typed.timestamp).toBeUndefined()
  })
})
