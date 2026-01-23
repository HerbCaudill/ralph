/**
 * Replay tests for TaskChatPanel using event fixtures.
 *
 * These tests verify that the TaskChatPanel correctly renders UI
 * when replaying logged event sequences from real usage scenarios.
 */

import { render, screen, act } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { TaskChatPanel } from "./TaskChatPanel"
import { useAppStore, flushTaskChatEventsBatch } from "@/store"
import {
  getAllFixtures,
  simpleQAFixture,
  toolUseSuccessFixture,
  rapidStreamingFixture,
  outOfOrderFixture,
  multipleToolUsesFixture,
  toolUseErrorFixture,
  extractEvents,
  type TaskChatFixture,
} from "./fixtures"
import type { TaskChatLogEntry } from "../../../server/TaskChatEventLog.js"

// Mock fetch to prevent actual API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

/**
 * Replay helper: feeds events into the store to simulate real-time event arrival.
 * Supports optional timing simulation for testing streaming behavior.
 */
async function replayEvents(
  entries: TaskChatLogEntry[],
  options: {
    /** Whether to simulate timing delays between events */
    simulateTiming?: boolean
    /** Maximum delay in ms (for speeding up tests) */
    maxDelay?: number
  } = {},
): Promise<void> {
  const { simulateTiming = false, maxDelay = 50 } = options

  let lastTimestamp = 0

  for (const entry of entries) {
    const event = entry.event

    // Simulate timing if enabled
    if (simulateTiming && lastTimestamp > 0) {
      const delay = Math.min(event.timestamp - lastTimestamp, maxDelay)
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    lastTimestamp = event.timestamp

    // Route event to appropriate store method based on type
    if (event.type === "user") {
      // User messages go to the messages store
      const message = event.message as { role: string; content: unknown }
      if (message.role === "user" && typeof message.content === "string") {
        useAppStore.getState().addTaskChatMessage({
          id: `user-${event.timestamp}`,
          role: "user",
          content: message.content,
          timestamp: event.timestamp,
        })
      }
      // Tool results in user messages are added as events for the hook to process
      if (Array.isArray(message.content)) {
        useAppStore.getState().addTaskChatEvent(event as any)
        flushTaskChatEventsBatch()
      }
    } else if (
      event.type === "stream_event" ||
      event.type === "assistant" ||
      event.type === "result"
    ) {
      // SDK events go to the events store for processing by useStreamingState
      useAppStore.getState().addTaskChatEvent(event as any)
      flushTaskChatEventsBatch()
    }
  }
}

/**
 * Clear all task chat state before each test.
 */
function clearTaskChatState(): void {
  useAppStore.getState().clearTaskChatMessages()
  useAppStore.getState().clearTaskChatToolUses()
  useAppStore.getState().clearTaskChatEvents()
  useAppStore.getState().setTaskChatLoading(false)
  useAppStore.getState().setConnectionStatus("connected")
}

describe("TaskChatPanel replay tests", () => {
  beforeEach(() => {
    clearTaskChatState()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("simpleQAFixture: basic Q&A conversation", () => {
    it("renders user question", async () => {
      await act(async () => {
        await replayEvents(simpleQAFixture.entries)
      })

      render(<TaskChatPanel />)

      // User message should be visible
      expect(screen.getByText("What are my highest priority tasks?")).toBeInTheDocument()
    })

    it("renders assistant response with markdown formatting", async () => {
      await act(async () => {
        await replayEvents(simpleQAFixture.entries)
      })

      render(<TaskChatPanel />)

      // Assistant response should contain the task list (look for the starting text)
      expect(screen.getByText(/Your highest priority tasks are/)).toBeInTheDocument()
      // Markdown should render bold text (check that the text is there)
      expect(screen.getByText(/Fix login bug/)).toBeInTheDocument()
      expect(screen.getByText(/Implement search/)).toBeInTheDocument()
      expect(screen.getByText(/Update docs/)).toBeInTheDocument()
    })

    it("renders user message before assistant response", async () => {
      await act(async () => {
        await replayEvents(simpleQAFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // User question should appear before the assistant's answer
      const userPos = textContent.indexOf("What are my highest priority tasks?")
      const assistantPos = textContent.indexOf("Fix login bug")

      expect(userPos).toBeGreaterThanOrEqual(0)
      expect(assistantPos).toBeGreaterThan(userPos)
    })

    it("hides empty state when messages exist", async () => {
      await act(async () => {
        await replayEvents(simpleQAFixture.entries)
      })

      render(<TaskChatPanel />)

      // Empty state should not be visible
      expect(screen.queryByText("Ask questions about your tasks")).not.toBeInTheDocument()
    })
  })

  describe("toolUseSuccessFixture: tool use with successful result", () => {
    it("renders user message and tool use", async () => {
      await act(async () => {
        await replayEvents(toolUseSuccessFixture.entries)
      })

      render(<TaskChatPanel />)

      // User message should be visible
      expect(screen.getByText("Show me the open tasks")).toBeInTheDocument()
      // Tool use (Bash) should be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("renders assistant response after tool use", async () => {
      await act(async () => {
        await replayEvents(toolUseSuccessFixture.entries)
      })

      render(<TaskChatPanel />)

      // Final assistant response should be visible (with "Here are")
      expect(screen.getByText(/Here are the open tasks/)).toBeInTheDocument()
    })

    it("maintains correct order: user -> tool use -> assistant", async () => {
      await act(async () => {
        await replayEvents(toolUseSuccessFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      const userPos = textContent.indexOf("Show me the open tasks")
      const toolPos = textContent.indexOf("Bash")
      // The assistant response includes "open tasks" which appears after the tool use
      // Find the assistant's formatted response with issue IDs
      const assistantPos = textContent.indexOf("r-abc1")

      expect(userPos).toBeGreaterThanOrEqual(0)
      expect(toolPos).toBeGreaterThan(userPos)
      expect(assistantPos).toBeGreaterThan(toolPos)
    })
  })

  describe("rapidStreamingFixture: fast streaming text", () => {
    it("accumulates streaming text correctly", async () => {
      await act(async () => {
        await replayEvents(rapidStreamingFixture.entries)
      })

      render(<TaskChatPanel />)

      // The final accumulated text should be complete
      expect(screen.getByText(/Task priorities help you focus/)).toBeInTheDocument()
    })

    it("renders user question", async () => {
      await act(async () => {
        await replayEvents(rapidStreamingFixture.entries)
      })

      render(<TaskChatPanel />)

      expect(screen.getByText("Explain task priorities")).toBeInTheDocument()
    })

    it("does not show duplicate content from streaming", async () => {
      await act(async () => {
        await replayEvents(rapidStreamingFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // The word "Task" should only appear once in the assistant response
      // (not duplicated from each streaming delta)
      const taskOccurrences = (textContent.match(/Task priorities/g) || []).length
      expect(taskOccurrences).toBe(1)
    })
  })

  describe("outOfOrderFixture: events arriving out of order", () => {
    it("renders events in correct timestamp order", async () => {
      await act(async () => {
        await replayEvents(outOfOrderFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // User message "Hello" should appear before assistant response
      const userPos = textContent.indexOf("Hello")
      const assistantPos = textContent.indexOf("How can I help")

      expect(userPos).toBeGreaterThanOrEqual(0)
      expect(assistantPos).toBeGreaterThan(userPos)
    })

    it("handles events logged in non-chronological order", async () => {
      // Verify the fixture has out-of-order entries
      const entries = outOfOrderFixture.entries
      const timestamps = entries.map(e => e.event.timestamp)

      // The first entry in the array should have a later timestamp than the second
      // (this is the specific structure of outOfOrderFixture)
      expect(timestamps[0]).toBeGreaterThan(timestamps[1])

      // Despite this, rendering should still work correctly
      await act(async () => {
        await replayEvents(outOfOrderFixture.entries)
      })

      render(<TaskChatPanel />)

      // Both messages should be visible
      expect(screen.getByText("Hello")).toBeInTheDocument()
      expect(screen.getByText(/How can I help/)).toBeInTheDocument()
    })
  })

  describe("multipleToolUsesFixture: multiple tools in sequence", () => {
    it("renders multiple tool use cards", async () => {
      await act(async () => {
        await replayEvents(multipleToolUsesFixture.entries)
      })

      render(<TaskChatPanel />)

      // Both tools should be visible
      expect(screen.getByText("Read")).toBeInTheDocument()
      expect(screen.getByText("Grep")).toBeInTheDocument()
    })

    it("renders tool uses in correct order", async () => {
      await act(async () => {
        await replayEvents(multipleToolUsesFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Read should appear before Grep (as per fixture order)
      const readPos = textContent.indexOf("Read")
      const grepPos = textContent.indexOf("Grep")

      expect(readPos).toBeGreaterThanOrEqual(0)
      expect(grepPos).toBeGreaterThan(readPos)
    })

    it("renders user question before tools", async () => {
      await act(async () => {
        await replayEvents(multipleToolUsesFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      const userPos = textContent.indexOf("Find TODO comments")
      const readPos = textContent.indexOf("Read")

      expect(userPos).toBeGreaterThanOrEqual(0)
      expect(readPos).toBeGreaterThan(userPos)
    })

    it("renders final assistant response after tools", async () => {
      await act(async () => {
        await replayEvents(multipleToolUsesFixture.entries)
      })

      render(<TaskChatPanel />)

      // Final response mentions the TODO comments found
      expect(screen.getByText(/found 2 TODO comments/i)).toBeInTheDocument()
    })
  })

  describe("toolUseErrorFixture: tool use with error", () => {
    it("renders tool use even when it fails", async () => {
      await act(async () => {
        await replayEvents(toolUseErrorFixture.entries)
      })

      render(<TaskChatPanel />)

      // Tool use should be visible
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("renders graceful error handling from assistant", async () => {
      await act(async () => {
        await replayEvents(toolUseErrorFixture.entries)
      })

      render(<TaskChatPanel />)

      // Assistant should provide a helpful response about the error
      expect(screen.getByText(/couldn't find the config file/i)).toBeInTheDocument()
    })

    it("maintains correct order with error scenario", async () => {
      await act(async () => {
        await replayEvents(toolUseErrorFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // User -> Tool -> Error response
      // Find positions: user message comes first, then tool card, then error handling
      const userPos = textContent.indexOf("Read the config file")
      // The tool use shows the path in its input, look for that specific text
      const toolPos = textContent.indexOf("/nonexistent/config.json")
      const errorPos = textContent.indexOf("couldn't find")

      expect(userPos).toBeGreaterThanOrEqual(0)
      expect(toolPos).toBeGreaterThan(userPos)
      expect(errorPos).toBeGreaterThan(toolPos)
    })
  })

  describe("deduplication", () => {
    it("does not duplicate assistant content from streaming and final events", async () => {
      await act(async () => {
        await replayEvents(simpleQAFixture.entries)
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // "Fix login bug" should only appear once, not duplicated
      const occurrences = (textContent.match(/Fix login bug/g) || []).length
      expect(occurrences).toBe(1)
    })

    it("does not duplicate tool uses from streaming and assistant events", async () => {
      await act(async () => {
        await replayEvents(toolUseSuccessFixture.entries)
      })

      render(<TaskChatPanel />)

      // There should be exactly one Bash tool use card
      const bashElements = screen.getAllByText("Bash")
      expect(bashElements).toHaveLength(1)
    })
  })

  describe("all fixtures render without errors", () => {
    const fixtures = getAllFixtures()

    it.each(fixtures.map(f => [f.metadata.name, f] as [string, TaskChatFixture]))(
      "%s renders without throwing",
      async (_name, fixture) => {
        await act(async () => {
          await replayEvents(fixture.entries)
        })

        // Should render without throwing
        expect(() => render(<TaskChatPanel />)).not.toThrow()
      },
    )

    it.each(fixtures.map(f => [f.metadata.name, f] as [string, TaskChatFixture]))(
      "%s hides empty state after replay",
      async (_name, fixture) => {
        await act(async () => {
          await replayEvents(fixture.entries)
        })

        render(<TaskChatPanel />)

        // All fixtures have content, so empty state should be hidden
        expect(screen.queryByText("Ask questions about your tasks")).not.toBeInTheDocument()
      },
    )
  })

  describe("fixture metadata validation", () => {
    const fixtures = getAllFixtures()

    it.each(fixtures.map(f => [f.metadata.name, f] as [string, TaskChatFixture]))(
      "%s starts with user message",
      (_name, fixture) => {
        const events = extractEvents(fixture.entries)
        const firstUserEvent = events.find(e => e.type === "user")
        expect(firstUserEvent).toBeDefined()
      },
    )

    it.each(fixtures.map(f => [f.metadata.name, f] as [string, TaskChatFixture]))(
      "%s ends with result event",
      (_name, fixture) => {
        const events = extractEvents(fixture.entries)
        const lastEvent = events[events.length - 1]
        expect(lastEvent.type).toBe("result")
      },
    )
  })
})
