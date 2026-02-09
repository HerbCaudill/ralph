import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentViewProvider } from "../../context/AgentViewProvider"
import { EventStreamEventItem } from "../EventStreamEventItem"
import type { ChatEvent } from "../../types"

/**
 * Test that EventStreamEventItem renders agent-server event types
 * (message, thinking) that are emitted by ClaudeAdapter and CodexAdapter
 * as individual events (not wrapped in assistant message content blocks).
 */
describe("EventStreamEventItem - agent-server event types", () => {
  const toolOutput = { isVisible: true, onToggle: vi.fn() }
  const emptyToolResults = new Map<string, { output?: string; error?: string }>()

  describe("message events", () => {
    it("should render non-partial message events as assistant text", () => {
      const event: ChatEvent = {
        type: "message",
        timestamp: 100,
        content: "I'll check the test output now.",
        isPartial: false,
      }

      render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={event}
            toolResults={emptyToolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      expect(screen.getByText(/check the test output/)).toBeInTheDocument()
    })

    it("should not render partial message events", () => {
      const event: ChatEvent = {
        type: "message",
        timestamp: 100,
        content: "partial streaming text",
        isPartial: true,
      }

      const { container } = render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={event}
            toolResults={emptyToolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      expect(container.textContent).toBe("")
    })
  })

  describe("thinking events", () => {
    it("should render non-partial thinking events as thinking blocks", () => {
      const event: ChatEvent = {
        type: "thinking",
        timestamp: 100,
        content: "Let me analyze the error logs to find the root cause.",
        isPartial: false,
      }

      render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={event}
            toolResults={emptyToolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      // ThinkingBlock renders collapsed by default with "Thinking..." header
      expect(screen.getByText("Thinking...")).toBeInTheDocument()
    })

    it("should not render partial thinking events", () => {
      const event: ChatEvent = {
        type: "thinking",
        timestamp: 100,
        content: "partial thinking",
        isPartial: true,
      }

      const { container } = render(
        <AgentViewProvider value={{ toolOutput }}>
          <EventStreamEventItem
            event={event}
            toolResults={emptyToolResults}
            hasStructuredLifecycleEvents={false}
            eventIndex={0}
          />
        </AgentViewProvider>,
      )

      expect(container.textContent).toBe("")
    })
  })
})
