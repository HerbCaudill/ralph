import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { EventStreamEventItem } from "@herbcaudill/agent-view"
import { useAppStore } from "@/store"

describe("EventStreamEventItem", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.getState().setIssuePrefix("r")
  })

  describe("ralph_task_started events", () => {
    it("renders a task lifecycle event with action 'starting'", () => {
      useAppStore
        .getState()
        .setTasks([{ id: "r-abc1", title: "Implement feature", status: "in_progress" }])

      render(
        <EventStreamEventItem
          event={{
            type: "ralph_task_started",
            timestamp: 1234567890,
            taskId: "r-abc1",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()
      expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "starting")
      expect(screen.getByText("Starting")).toBeInTheDocument()
    })

    it("renders without taskId (uses empty string fallback)", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "ralph_task_started",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()
      expect(screen.getByText("Starting")).toBeInTheDocument()
    })
  })

  describe("ralph_task_completed events", () => {
    it("renders a task lifecycle event with action 'completed'", () => {
      useAppStore.getState().setTasks([{ id: "r-xyz9", title: "Fix bug", status: "closed" }])

      render(
        <EventStreamEventItem
          event={{
            type: "ralph_task_completed",
            timestamp: 1234567890,
            taskId: "r-xyz9",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()
      expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "completed")
      expect(screen.getByText("Completed")).toBeInTheDocument()
    })

    it("renders without taskId (uses empty string fallback)", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "ralph_task_completed",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()
      expect(screen.getByText("Completed")).toBeInTheDocument()
    })
  })

  describe("assistant message events", () => {
    it("renders assistant message with text content blocks", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "assistant",
            timestamp: 1234567890,
            message: {
              content: [{ type: "text", text: "Hello from the assistant" }],
            },
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByText("Hello from the assistant")).toBeInTheDocument()
    })

    it("returns null for assistant message with empty content array", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "assistant",
            timestamp: 1234567890,
            message: {
              content: [],
            },
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })

    it("returns null for assistant message with no message object", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "assistant",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe("error events", () => {
    it("renders error events with type 'error'", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "error",
            timestamp: 1234567890,
            error: "Something went wrong",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("error-event")).toBeInTheDocument()
      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Error")).toBeInTheDocument()
    })

    it("renders error events with type 'server_error'", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "server_error",
            timestamp: 1234567890,
            error: "Ralph is not running",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("error-event")).toBeInTheDocument()
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
      expect(screen.getByText("Server Error")).toBeInTheDocument()
    })

    it("does not render events without error string", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "error",
            timestamp: 1234567890,
            // Missing error field
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.queryByTestId("error-event")).not.toBeInTheDocument()
    })
  })

  describe("user message events", () => {
    it("renders user message events", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "user_message",
            timestamp: 1234567890,
            message: "Hello, world!",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByText("Hello, world!")).toBeInTheDocument()
    })
  })

  describe("unrecognized events", () => {
    it("returns null for unrecognized event types", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "unknown_type",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })

    it("returns null for stream_event type", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "stream_event",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })

    it("returns null for system event type", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "system",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })
  })
})
