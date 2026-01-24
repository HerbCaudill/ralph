import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { EventDisplay, useEventDisplayState } from "./EventDisplay"
import { TaskDialogProvider } from "@/contexts"
import type { ChatEvent } from "@/types"
import { renderHook } from "@testing-library/react"

// Helper to render EventDisplay with required providers
function renderEventDisplay(props: Parameters<typeof EventDisplay>[0]) {
  const openTaskById = vi.fn()
  return render(
    <TaskDialogProvider openTaskById={openTaskById}>
      <EventDisplay {...props} />
    </TaskDialogProvider>,
  )
}

describe("EventDisplay", () => {
  describe("rendering events", () => {
    it("renders user message events", () => {
      const events: ChatEvent[] = [
        {
          type: "user_message",
          timestamp: Date.now(),
          message: "Hello, world!",
        },
      ]

      renderEventDisplay({ events })
      expect(screen.getByText("Hello, world!")).toBeInTheDocument()
    })

    it("renders assistant text events", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: Date.now(),
          message: {
            content: [
              {
                type: "text",
                text: "This is a response",
              },
            ],
          },
        },
      ]

      renderEventDisplay({ events })
      expect(screen.getByText("This is a response")).toBeInTheDocument()
    })

    it("renders tool use events", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: Date.now(),
          message: {
            content: [
              {
                type: "tool_use",
                id: "tool-1",
                name: "Read",
                input: { file_path: "/test/file.txt" },
              },
            ],
          },
        },
      ]

      renderEventDisplay({ events })
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("shows empty state when there are no events", () => {
      renderEventDisplay({
        events: [],
        emptyState: <div data-testid="empty-state">No events</div>,
      })
      expect(screen.getByTestId("empty-state")).toBeInTheDocument()
    })

    it("shows loading indicator when provided", () => {
      const events: ChatEvent[] = [
        {
          type: "user_message",
          timestamp: Date.now(),
          message: "Hello",
        },
      ]

      renderEventDisplay({
        events,
        loadingIndicator: <div data-testid="loading">Loading...</div>,
      })
      expect(screen.getByTestId("loading")).toBeInTheDocument()
    })
  })

  describe("maxEvents prop", () => {
    it("limits displayed events to maxEvents", () => {
      const events: ChatEvent[] = Array.from({ length: 10 }, (_, i) => ({
        type: "user_message",
        timestamp: Date.now() + i,
        message: `Message ${i}`,
      }))

      renderEventDisplay({ events, maxEvents: 3 })

      // Should only show the last 3 events
      expect(screen.queryByText("Message 6")).not.toBeInTheDocument()
      expect(screen.getByText("Message 7")).toBeInTheDocument()
      expect(screen.getByText("Message 8")).toBeInTheDocument()
      expect(screen.getByText("Message 9")).toBeInTheDocument()
    })
  })

  describe("tool results", () => {
    it("displays tool results when available", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: Date.now(),
          message: {
            content: [
              {
                type: "tool_use",
                id: "tool-1",
                name: "Read",
                input: { file_path: "/test/file.txt" },
              },
            ],
          },
        },
        {
          type: "user",
          timestamp: Date.now() + 1,
          message: {
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-1",
                content: "File contents here",
              },
            ],
          },
        },
      ]

      renderEventDisplay({ events })
      expect(screen.getByText("Read")).toBeInTheDocument()
    })
  })

  describe("aria-label", () => {
    it("uses custom aria label", () => {
      const events: ChatEvent[] = []

      renderEventDisplay({
        events,
        ariaLabel: "Custom event log",
        emptyState: <div>Empty</div>,
      })

      expect(screen.getByRole("log", { name: "Custom event log" })).toBeInTheDocument()
    })
  })

  describe("className", () => {
    it("applies custom className", () => {
      renderEventDisplay({
        events: [],
        className: "custom-class",
        emptyState: <div>Empty</div>,
      })

      const container = screen.getByRole("log").parentElement
      expect(container).toHaveClass("custom-class")
    })
  })
})

describe("useEventDisplayState", () => {
  it("returns completed events", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        timestamp: Date.now(),
        message: "Hello",
      },
      {
        type: "assistant",
        timestamp: Date.now() + 1,
        message: {
          content: [{ type: "text", text: "Hi there" }],
        },
      },
    ]

    const { result } = renderHook(() => useEventDisplayState(events))

    expect(result.current.completedEvents).toHaveLength(2)
    expect(result.current.streamingMessage).toBeNull()
  })

  it("builds tool results map", () => {
    const events: ChatEvent[] = [
      {
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Read",
              input: {},
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: Date.now() + 1,
        tool_use_result: true,
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "Result content",
            },
          ],
        },
      },
    ]

    const { result } = renderHook(() => useEventDisplayState(events))

    expect(result.current.toolResults.has("tool-1")).toBe(true)
    expect(result.current.toolResults.get("tool-1")).toEqual({
      output: "Result content",
      error: undefined,
    })
  })

  it("detects structured lifecycle events", () => {
    const eventsWithLifecycle: ChatEvent[] = [
      {
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "task-1",
        taskTitle: "Test task",
      },
    ]

    const { result } = renderHook(() => useEventDisplayState(eventsWithLifecycle))
    expect(result.current.hasStructuredLifecycleEvents).toBe(true)

    const eventsWithoutLifecycle: ChatEvent[] = [
      {
        type: "user_message",
        timestamp: Date.now(),
        message: "Hello",
      },
    ]

    const { result: result2 } = renderHook(() => useEventDisplayState(eventsWithoutLifecycle))
    expect(result2.current.hasStructuredLifecycleEvents).toBe(false)
  })

  it("handles streaming state", () => {
    const events: ChatEvent[] = [
      {
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "message_start",
        },
      },
      {
        type: "stream_event",
        timestamp: Date.now() + 1,
        event: {
          type: "content_block_start",
          content_block: {
            type: "text",
            text: "",
          },
        },
      },
      {
        type: "stream_event",
        timestamp: Date.now() + 2,
        event: {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "Streaming...",
          },
        },
      },
    ]

    const { result } = renderHook(() => useEventDisplayState(events))

    expect(result.current.streamingMessage).not.toBeNull()
    expect(result.current.streamingMessage?.contentBlocks[0].type).toBe("text")
    expect((result.current.streamingMessage?.contentBlocks[0] as any).text).toBe("Streaming...")
  })
})
