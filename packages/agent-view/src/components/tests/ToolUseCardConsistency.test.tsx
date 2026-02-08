import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { EventStreamEventItem } from "../EventStreamEventItem"
import { buildToolResultsMap } from "../../lib/buildToolResultsMap"
import type { ChatEvent, ToolUseChatEvent, AssistantChatEvent } from "../../types"

/**
 * Test for bug r-4qay1: Tool blocks show different content in task chat vs Ralph panel
 *
 * Issue: Task chat displays tool blocks with the command but no output.
 *        Ralph panel displays tool blocks with the output but not the command.
 *        Both should show both the command/input AND the output for consistency.
 */
describe("ToolUseCard consistency", () => {
  const toolOutput = { isVisible: true, onToggle: vi.fn() }

  describe("assistant message with tool_use blocks (task chat flow)", () => {
    it("should show both command/input AND output when tool_result is available", () => {
      // This simulates the task chat flow where we get:
      // 1. An assistant event with tool_use blocks in message.content
      // 2. A tool_result event that provides the output
      const assistantEvent: AssistantChatEvent = {
        type: "assistant",
        timestamp: 100,
        message: {
          id: "msg_123",
          content: [
            {
              type: "tool_use",
              id: "toolu_abc",
              name: "Bash",
              input: { command: "ls -la" },
            },
          ],
        },
      }

      // Build toolResults map as EventList would
      const toolResults = new Map([["toolu_abc", { output: "file1.txt\nfile2.txt", error: undefined }]])

      render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={assistantEvent}
            toolResults={toolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      // Should show the tool name
      expect(screen.getByText("Bash")).toBeInTheDocument()

      // Should show the command (input summary)
      expect(screen.getByText("ls -la")).toBeInTheDocument()

      // Should show the output (when expanded)
      expect(screen.getByText(/file1\.txt/)).toBeInTheDocument()
    })
  })

  describe("standalone tool_use event (Ralph panel flow)", () => {
    it("should show both command/input AND output", () => {
      // This simulates the Ralph panel flow where we get standalone tool_use events
      // that may include output directly (after being updated from tool_result)
      const toolUseEvent: ToolUseChatEvent = {
        type: "tool_use",
        timestamp: 100,
        tool: "Bash",
        input: { command: "ls -la" },
        output: "file1.txt\nfile2.txt",
        status: "success",
        toolUseId: "toolu_abc",
      }

      const toolResults = new Map<string, { output?: string; error?: string }>()

      render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={toolUseEvent}
            toolResults={toolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      // Should show the tool name
      expect(screen.getByText("Bash")).toBeInTheDocument()

      // Should show the command (input summary)
      expect(screen.getByText("ls -la")).toBeInTheDocument()

      // Should show the output
      expect(screen.getByText(/file1\.txt/)).toBeInTheDocument()
    })

    it("should show command/input even when output comes from toolResults map", () => {
      // This simulates when tool_use event doesn't have output but tool_result
      // was received separately and is available in toolResults
      const toolUseEvent: ToolUseChatEvent = {
        type: "tool_use",
        timestamp: 100,
        tool: "Bash",
        input: { command: "ls -la" },
        status: "running",
        toolUseId: "toolu_abc",
      }

      const toolResults = new Map([["toolu_abc", { output: "file1.txt\nfile2.txt", error: undefined }]])

      render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={toolUseEvent}
            toolResults={toolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      // Should show the tool name
      expect(screen.getByText("Bash")).toBeInTheDocument()

      // Should show the command (input summary)
      expect(screen.getByText("ls -la")).toBeInTheDocument()

      // Should show the output from toolResults
      expect(screen.getByText(/file1\.txt/)).toBeInTheDocument()
    })
  })

  describe("consistent display across both flows", () => {
    it("should render identically for assistant message vs standalone tool_use with same data", () => {
      const toolResults = new Map([["toolu_abc", { output: "output text", error: undefined }]])

      // Flow 1: Assistant message with tool_use block
      const { container: container1 } = render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={{
              type: "assistant",
              timestamp: 100,
              message: {
                content: [
                  {
                    type: "tool_use",
                    id: "toolu_abc",
                    name: "Bash", // Use Bash instead of Read to avoid summary-only behavior
                    input: { command: "echo hello" },
                  },
                ],
              },
            } as AssistantChatEvent}
            toolResults={toolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      // Flow 2: Standalone tool_use event with output from toolResults
      const { container: container2 } = render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={{
              type: "tool_use",
              timestamp: 100,
              tool: "Bash",
              input: { command: "echo hello" },
              status: "success",
              toolUseId: "toolu_abc",
            } as ToolUseChatEvent}
            toolResults={toolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      // Both should contain the same visible elements
      // (We can't compare innerHTML directly due to React internals, but we can check key content)
      expect(container1.textContent).toContain("Bash")
      expect(container1.textContent).toContain("echo hello")
      expect(container1.textContent).toContain("output text")

      expect(container2.textContent).toContain("Bash")
      expect(container2.textContent).toContain("echo hello")
      expect(container2.textContent).toContain("output text")
    })
  })

  describe("buildToolResultsMap integration", () => {
    it("should build toolResults from standalone tool_result events", () => {
      // This simulates the event flow from agent-server
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 100,
          message: {
            content: [
              {
                type: "tool_use",
                id: "toolu_123",
                name: "Bash",
                input: { command: "ls" },
              },
            ],
          },
        } as AssistantChatEvent,
        // Standalone tool_result event (from agent-server handleUserMessage)
        {
          type: "tool_result",
          timestamp: 200,
          toolUseId: "toolu_123",
          output: "file1.txt\nfile2.txt",
        } as ChatEvent,
      ]

      const { toolResults } = buildToolResultsMap(events)

      expect(toolResults.get("toolu_123")).toEqual({
        output: "file1.txt\nfile2.txt",
        error: undefined,
      })
    })

    it("should build toolResults from legacy user events with tool_use_result", () => {
      // This simulates the legacy format used in Storybook and older events
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 100,
          message: {
            content: [
              {
                type: "tool_use",
                id: "toolu_456",
                name: "Read",
                input: { file_path: "/test.txt" },
              },
            ],
          },
        } as AssistantChatEvent,
        // Legacy format: user event with tool_use_result
        {
          type: "user",
          timestamp: 200,
          tool_use_result: true,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_456",
                content: "file contents",
              },
            ],
          },
        } as ChatEvent,
      ]

      const { toolResults } = buildToolResultsMap(events)

      expect(toolResults.get("toolu_456")).toEqual({
        output: "file contents",
        error: undefined,
      })
    })
  })
})
