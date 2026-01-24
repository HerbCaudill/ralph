import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { EventList, useEventListState } from "./EventList"
import { TaskDialogProvider } from "@/contexts"
import type { ChatEvent } from "@/types"
import { renderHook } from "@testing-library/react"

// Helper to render EventList with required providers
function renderEventList(props: Parameters<typeof EventList>[0]) {
  const openTaskById = vi.fn()
  return render(
    <TaskDialogProvider openTaskById={openTaskById}>
      <EventList {...props} />
    </TaskDialogProvider>,
  )
}

describe("EventList", () => {
  describe("rendering events", () => {
    it("renders user message events", () => {
      const events: ChatEvent[] = [
        {
          type: "user_message",
          timestamp: Date.now(),
          message: "Hello, world!",
        },
      ]

      renderEventList({ events })
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

      renderEventList({ events })
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

      renderEventList({ events })
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("returns null when there are no events", () => {
      const { container } = renderEventList({ events: [] })
      expect(container.firstChild).toBeNull()
    })

    it("shows loading indicator when provided", () => {
      const events: ChatEvent[] = [
        {
          type: "user_message",
          timestamp: Date.now(),
          message: "Hello",
        },
      ]

      renderEventList({
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

      renderEventList({ events, maxEvents: 3 })

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

      renderEventList({ events })
      expect(screen.getByText("Read")).toBeInTheDocument()
    })
  })

  describe("task lifecycle events", () => {
    it("renders task started events", () => {
      const events: ChatEvent[] = [
        {
          type: "ralph_task_started",
          timestamp: Date.now(),
          taskId: "task-1",
          taskTitle: "Test task",
        },
      ]

      renderEventList({ events })
      expect(screen.getByText("Test task")).toBeInTheDocument()
    })

    it("renders task completed events", () => {
      const events: ChatEvent[] = [
        {
          type: "ralph_task_completed",
          timestamp: Date.now(),
          taskId: "task-1",
          taskTitle: "Test task",
        },
      ]

      renderEventList({ events })
      expect(screen.getByText("Test task")).toBeInTheDocument()
    })
  })
})

describe("useEventListState", () => {
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

    const { result } = renderHook(() => useEventListState(events))

    expect(result.current.completedEvents).toHaveLength(2)
    expect(result.current.displayedEvents).toHaveLength(2)
    expect(result.current.streamingMessage).toBeNull()
    expect(result.current.hasContent).toBe(true)
  })

  it("returns hasContent as false when no events", () => {
    const { result } = renderHook(() => useEventListState([]))

    expect(result.current.hasContent).toBe(false)
    expect(result.current.displayedEvents).toHaveLength(0)
  })

  it("respects maxEvents parameter", () => {
    const events: ChatEvent[] = Array.from({ length: 10 }, (_, i) => ({
      type: "user_message",
      timestamp: Date.now() + i,
      message: `Message ${i}`,
    }))

    const { result } = renderHook(() => useEventListState(events, 3))

    expect(result.current.completedEvents).toHaveLength(10)
    expect(result.current.displayedEvents).toHaveLength(3)
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

    const { result } = renderHook(() => useEventListState(events))

    expect(result.current.toolResults.has("tool-1")).toBe(true)
    expect(result.current.toolResults.get("tool-1")).toEqual({
      output: "Result content",
      error: undefined,
    })
  })

  it("handles tool errors", () => {
    const events: ChatEvent[] = [
      {
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Bash",
              input: { command: "exit 1" },
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
              content: "Command failed",
              is_error: true,
            },
          ],
        },
      },
    ]

    const { result } = renderHook(() => useEventListState(events))

    // When is_error is true, the error field is set and output is undefined
    // (based on the implementation in EventList.tsx)
    const toolResult = result.current.toolResults.get("tool-1")
    expect(toolResult?.error).toBe("Command failed")
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

    const { result } = renderHook(() => useEventListState(eventsWithLifecycle))
    expect(result.current.hasStructuredLifecycleEvents).toBe(true)

    const eventsWithoutLifecycle: ChatEvent[] = [
      {
        type: "user_message",
        timestamp: Date.now(),
        message: "Hello",
      },
    ]

    const { result: result2 } = renderHook(() => useEventListState(eventsWithoutLifecycle))
    expect(result2.current.hasStructuredLifecycleEvents).toBe(false)
  })

  it("detects completed lifecycle events", () => {
    const events: ChatEvent[] = [
      {
        type: "ralph_task_completed",
        timestamp: Date.now(),
        taskId: "task-1",
        taskTitle: "Test task",
      },
    ]

    const { result } = renderHook(() => useEventListState(events))
    expect(result.current.hasStructuredLifecycleEvents).toBe(true)
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

    const { result } = renderHook(() => useEventListState(events))

    expect(result.current.streamingMessage).not.toBeNull()
    expect(result.current.streamingMessage?.contentBlocks[0].type).toBe("text")
    expect((result.current.streamingMessage?.contentBlocks[0] as any).text).toBe("Streaming...")
    expect(result.current.hasContent).toBe(true)
  })

  it("returns hasContent true when only streaming", () => {
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
    ]

    const { result } = renderHook(() => useEventListState(events))

    expect(result.current.displayedEvents).toHaveLength(0)
    expect(result.current.streamingMessage).not.toBeNull()
    expect(result.current.hasContent).toBe(true)
  })
})
