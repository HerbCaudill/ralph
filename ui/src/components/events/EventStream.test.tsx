import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventStream } from "./EventStream"
import { useAppStore, DEFAULT_INSTANCE_ID } from "@/store"
import { TaskDialogProvider } from "@/contexts"

// Helper to render EventStream with required providers
function renderEventStream(props?: { instanceId?: string; maxEvents?: number }) {
  const openTaskById = vi.fn()
  return render(
    <TaskDialogProvider openTaskById={openTaskById}>
      <EventStream {...props} />
    </TaskDialogProvider>,
  )
}

describe("EventStream", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset()
    useAppStore.getState().setShowToolOutput(true)
  })

  describe("Task lifecycle events", () => {
    it("renders task lifecycle event as structured block, not plain text", () => {
      // Add an assistant message with a task lifecycle event
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            {
              type: "text",
              text: "<start_task>r-abc1</start_task>",
            },
          ],
        },
      })

      renderEventStream()

      // Should render as TaskLifecycleEvent (with data-testid="task-lifecycle-event")
      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()

      // Should show the structured elements
      expect(screen.getByText("Starting")).toBeInTheDocument() // The label
      expect(screen.getByText("r-abc1")).toBeInTheDocument() // The task ID

      // Should NOT render the raw XML text
      // The structured block should be the primary rendering
    })

    it("handles streaming task lifecycle events - WHILE streaming shows as text", () => {
      // Simulate streaming a task lifecycle event
      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "message_start",
        },
      })

      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "content_block_start",
          content_block: {
            type: "text",
            text: "",
          },
        },
      })

      // Stream the task lifecycle text incrementally
      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "<start_task>r-xyz2</start_task>",
          },
        },
      })

      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "content_block_stop",
        },
      })

      renderEventStream()

      // WHILE streaming (before message_stop), should render as TaskLifecycleEvent
      // because the text is complete even though the message isn't stopped yet
      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()
      expect(screen.getByText("Starting")).toBeInTheDocument()
      expect(screen.getByText("r-xyz2")).toBeInTheDocument()
    })

    it("renders ralph_task_started events as structured blocks", () => {
      // Add a ralph_task_started event (emitted by CLI)
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "r-abc1",
        taskTitle: "Implement new feature",
        iteration: 1,
      })

      renderEventStream()

      // Should render as TaskLifecycleEvent
      const lifecycleEvent = screen.getByTestId("task-lifecycle-event")
      expect(lifecycleEvent).toBeInTheDocument()
      expect(lifecycleEvent).toHaveTextContent("Starting")
      expect(lifecycleEvent).toHaveTextContent("r-abc1")
      expect(lifecycleEvent).toHaveTextContent("Implement new feature")
    })

    it("renders ralph_task_completed events as structured blocks", () => {
      // Add a ralph_task_completed event (emitted by CLI)
      useAppStore.getState().addEvent({
        type: "ralph_task_completed",
        timestamp: Date.now(),
        taskId: "r-xyz9",
        taskTitle: "Fix the bug",
        iteration: 1,
      })

      renderEventStream()

      // Should render as TaskLifecycleEvent with "completed" action
      const lifecycleEvent = screen.getByTestId("task-lifecycle-event")
      expect(lifecycleEvent).toBeInTheDocument()
      expect(lifecycleEvent).toHaveAttribute("data-action", "completed")
      expect(screen.getByText("Completed")).toBeInTheDocument()
      expect(screen.getByText("r-xyz9")).toBeInTheDocument()
      expect(screen.getByText("Fix the bug")).toBeInTheDocument()
    })

    it("does not duplicate task lifecycle rendering when both text and structured event are present", () => {
      // Simulate the scenario where CLI emits both:
      // 1. The assistant message with text
      // 2. The structured ralph_task_started event

      // First, the assistant message with task lifecycle text
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            {
              type: "text",
              text: "<start_task>r-abc1</start_task>",
            },
          ],
        },
      })

      // Then, the structured event
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: Date.now(),
        taskId: "r-abc1",
        taskTitle: "Implement new feature",
        iteration: 1,
      })

      renderEventStream()

      // Should render only ONE TaskLifecycleEvent block (from the structured event)
      // The text block should be skipped to avoid duplication
      const lifecycleEvents = screen.getAllByTestId("task-lifecycle-event")
      expect(lifecycleEvents).toHaveLength(1)

      // Verify it's the structured event that's rendered
      const lifecycleEvent = lifecycleEvents[0]
      expect(lifecycleEvent).toHaveTextContent("Starting")
      expect(lifecycleEvent).toHaveTextContent("r-abc1")
      expect(lifecycleEvent).toHaveTextContent("Implement new feature")
    })

    it("handles streaming task lifecycle events - after message_stop renders properly", () => {
      // Simulate streaming a task lifecycle event
      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "message_start",
        },
      })

      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "content_block_start",
          content_block: {
            type: "text",
            text: "",
          },
        },
      })

      // Stream the task lifecycle text incrementally
      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "<start_task>r-xyz2</start_task>",
          },
        },
      })

      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "content_block_stop",
        },
      })

      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: Date.now(),
        event: {
          type: "message_stop",
        },
      })

      renderEventStream()

      // After message_stop, should still render as TaskLifecycleEvent
      expect(screen.getByTestId("task-lifecycle-event")).toBeInTheDocument()
      expect(screen.getByText("Starting")).toBeInTheDocument()
      expect(screen.getByText("r-xyz2")).toBeInTheDocument()
    })
  })

  describe("IterationBar", () => {
    it("is always visible", () => {
      renderEventStream()
      expect(screen.getByTestId("iteration-bar")).toBeInTheDocument()
    })

    it("shows 'No active task' when no task is in progress and no iterations", () => {
      renderEventStream()
      expect(screen.getByText("No active task")).toBeInTheDocument()
    })

    it("shows task from iteration events when ralph_task_started event exists", () => {
      // Add iteration boundary
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      // Add ralph_task_started event
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600001000,
        taskId: "rui-123",
        taskTitle: "Fix the bug",
      })
      renderEventStream()
      // Check that task is shown in iteration bar
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-123")
      expect(iterationBar).toHaveTextContent("Fix the bug")
    })

    it("shows iteration navigation when multiple iterations exist", () => {
      // Add two iteration boundaries (system init events)
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })
      renderEventStream()
      expect(screen.getByLabelText("Previous iteration")).toBeInTheDocument()
      expect(screen.getByLabelText("Next iteration")).toBeInTheDocument()
    })

    it("hides navigation buttons when only one iteration", () => {
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      renderEventStream()
      expect(screen.queryByLabelText("Previous iteration")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Next iteration")).not.toBeInTheDocument()
    })

    it("navigates to previous iteration when Previous button is clicked", () => {
      // Add two iteration boundaries
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })
      renderEventStream()

      // Click previous
      fireEvent.click(screen.getByLabelText("Previous iteration"))

      // Should show "Iteration 1 of 2"
      expect(screen.getByText("Iteration 1 of 2")).toBeInTheDocument()
    })

    it("shows Latest button when viewing past iteration", () => {
      // Add two iteration boundaries
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })

      // Go to first iteration
      useAppStore.getState().setViewingIterationIndex(0)

      renderEventStream()
      expect(screen.getByText("Latest")).toBeInTheDocument()
    })

    it("displays current task instead of iteration info when task exists", () => {
      // Add two iterations
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskId: "rui-abc",
        taskTitle: "Current work",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600001500,
        taskId: "rui-def",
        taskTitle: "Latest work",
      })

      renderEventStream()

      // Should show task from latest iteration, not iteration info
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-def")
      expect(iterationBar).toHaveTextContent("Latest work")
      expect(screen.queryByText(/Iteration \d+ of \d+/)).not.toBeInTheDocument()
    })

    it("truncates long task titles", () => {
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskId: "rui-456",
        taskTitle: "This is a very long task description that should be truncated",
      })
      renderEventStream()
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-456")
      // Find the title within the iteration bar specifically
      const taskTitleInBar = iterationBar.querySelector(".truncate")
      expect(taskTitleInBar).toBeInTheDocument()
      expect(taskTitleInBar).toHaveTextContent(
        "This is a very long task description that should be truncated",
      )
    })

    it("shows task from specific iteration when navigating to past iteration", () => {
      // Add first iteration with task A
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskId: "rui-111",
        taskTitle: "First task",
      })

      // Add second iteration with task B
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600001500,
        taskId: "rui-222",
        taskTitle: "Second task",
      })

      renderEventStream()

      // Initially should show latest task in iteration bar
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-222")
      expect(iterationBar).toHaveTextContent("Second task")

      // Navigate to first iteration
      fireEvent.click(screen.getByLabelText("Previous iteration"))

      // Should now show first task in iteration bar
      expect(iterationBar).toHaveTextContent("rui-111")
      expect(iterationBar).toHaveTextContent("First task")
      expect(iterationBar).not.toHaveTextContent("rui-222")
    })

    it("shows task without ID when ralph_task_started event has only taskTitle", () => {
      // Add a ralph_task_started event with only taskTitle (no taskId)
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskTitle: "Support pausing via stdin",
      })

      renderEventStream()

      // Should show the task title in the iteration bar
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("Support pausing via stdin")

      // Should not show any task ID link
      expect(screen.queryByRole("button", { name: /View task/ })).not.toBeInTheDocument()
    })

    it("looks up task title from store when ralph_task_started event has only taskId", () => {
      // Add a task to the store with a known ID and title
      useAppStore.getState().setTasks([
        {
          id: "rui-xyz9",
          title: "Fix the iteration toolbar",
          status: "in_progress",
        },
      ])

      // Add a ralph_task_started event with only taskId (no taskTitle)
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskId: "rui-xyz9",
      })

      renderEventStream()

      // Should show the task title looked up from the store
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("Fix the iteration toolbar")
      expect(iterationBar).toHaveTextContent("rui-xyz9")
    })

    it("shows taskId as title when ralph_task_started has taskId but task not found in store", () => {
      // Empty tasks store
      useAppStore.getState().setTasks([])

      // Add a ralph_task_started event with only taskId
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskId: "rui-unknown",
      })

      renderEventStream()

      // Should show the task ID as the title (fallback)
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-unknown")
    })

    it("shows in-progress task from store when no ralph_task_started event exists", () => {
      // Set up tasks store with an in-progress task
      useAppStore.getState().setTasks([
        {
          id: "rui-in-progress",
          title: "Current task being worked on",
          status: "in_progress",
        },
        {
          id: "rui-open",
          title: "Another task",
          status: "open",
        },
      ])

      // Add some events but NO ralph_task_started event
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000500,
        message: "Work on the task",
      })

      renderEventStream()

      // Should show the in-progress task from the store as fallback
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-in-progress")
      expect(iterationBar).toHaveTextContent("Current task being worked on")
    })

    it("prefers ralph_task_started event over in-progress task from store", () => {
      // Set up tasks store with an in-progress task
      useAppStore.getState().setTasks([
        {
          id: "rui-in-progress",
          title: "Task from store",
          status: "in_progress",
        },
      ])

      // Add a ralph_task_started event for a DIFFERENT task
      useAppStore.getState().addEvent({
        type: "ralph_task_started",
        timestamp: 1705600000500,
        taskId: "rui-event-task",
        taskTitle: "Task from event",
      })

      renderEventStream()

      // Should show the task from the event, not the in-progress one from store
      const iterationBar = screen.getByTestId("iteration-bar")
      expect(iterationBar).toHaveTextContent("rui-event-task")
      expect(iterationBar).toHaveTextContent("Task from event")
      expect(iterationBar).not.toHaveTextContent("Task from store")
    })
  })

  describe("empty state", () => {
    it("shows empty message when no events", () => {
      renderEventStream()
      expect(screen.getByText("No events yet")).toBeInTheDocument()
    })

    it("has correct ARIA attributes", () => {
      renderEventStream()
      const container = screen.getByRole("log")
      expect(container).toHaveAttribute("aria-label", "Event stream")
      expect(container).toHaveAttribute("aria-live", "polite")
    })
  })

  describe("displaying user messages", () => {
    it("renders user_message events", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Hello, can you help me?",
      })
      renderEventStream()
      expect(screen.getByText("Hello, can you help me?")).toBeInTheDocument()
    })

    it("renders multiple user messages", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "First message",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Second message",
      })
      renderEventStream()
      expect(screen.getByText("First message")).toBeInTheDocument()
      expect(screen.getByText("Second message")).toBeInTheDocument()
    })
  })

  describe("displaying assistant messages", () => {
    it("renders assistant text content", () => {
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "text",
              text: "I can help you with that.",
            },
          ],
        },
      })
      renderEventStream()
      expect(screen.getByText("I can help you with that.")).toBeInTheDocument()
    })

    it("renders assistant tool_use content", () => {
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/test/file.ts" },
            },
          ],
        },
      })
      renderEventStream()
      expect(screen.getByText("Read")).toBeInTheDocument()
      expect(screen.getByText("/test/file.ts")).toBeInTheDocument()
    })

    it("renders assistant with text and tool_use mixed", () => {
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "text",
              text: "Let me read that file.",
            },
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/test/file.ts" },
            },
          ],
        },
      })
      renderEventStream()
      expect(screen.getByText("Let me read that file.")).toBeInTheDocument()
      expect(screen.getByText("Read")).toBeInTheDocument()
    })
  })

  describe("tool results", () => {
    it("shows tool result output when present", () => {
      // Add tool use
      useAppStore.getState().addEvent({
        type: "assistant",
        timestamp: 1705600000000,
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/test/file.ts" },
            },
          ],
        },
      })
      // Add tool result
      useAppStore.getState().addEvent({
        type: "user",
        timestamp: 1705600001000,
        tool_use_result: "File content",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_123",
              content: "line 1\nline 2\nline 3",
              is_error: false,
            },
          ],
        },
      })
      renderEventStream()
      // Should show line count for Read tool
      expect(screen.getByText(/Read 3 lines/)).toBeInTheDocument()
    })
  })

  describe("filtering events", () => {
    it("skips stream_event events (renders nothing visible)", () => {
      useAppStore.getState().addEvent({
        type: "stream_event",
        timestamp: 1705600000000,
        event: { type: "content_block_delta" },
      })
      renderEventStream()
      // Stream events render nothing, but the container has events so empty state doesn't show
      const container = screen.getByRole("log")
      // Should have no visible content (just the container)
      expect(container.textContent?.trim()).toBe("")
    })

    it("skips system events (renders nothing visible)", () => {
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      renderEventStream()
      // System events render nothing
      const container = screen.getByRole("log")
      expect(container.textContent?.trim()).toBe("")
    })
  })

  describe("maxEvents limit", () => {
    it("limits displayed events to maxEvents", () => {
      // Add 5 user messages
      for (let i = 0; i < 5; i++) {
        useAppStore.getState().addEvent({
          type: "user_message",
          timestamp: 1705600000000 + i * 1000,
          message: `Message ${i}`,
        })
      }
      render(<EventStream maxEvents={3} />)
      // Should only show the last 3 messages
      expect(screen.queryByText("Message 0")).not.toBeInTheDocument()
      expect(screen.queryByText("Message 1")).not.toBeInTheDocument()
      expect(screen.getByText("Message 2")).toBeInTheDocument()
      expect(screen.getByText("Message 3")).toBeInTheDocument()
      expect(screen.getByText("Message 4")).toBeInTheDocument()
    })
  })

  describe("scroll to bottom button", () => {
    it("does not show scroll to bottom button initially", () => {
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      renderEventStream()
      expect(screen.queryByLabelText("Scroll to latest events")).not.toBeInTheDocument()
    })

    it("shows scroll to bottom button when scrolled up", () => {
      // Add many events to make scrolling possible
      for (let i = 0; i < 100; i++) {
        useAppStore.getState().addEvent({
          type: "user_message",
          timestamp: 1705600000000 + i * 1000,
          message: `Message ${i}`,
        })
      }
      renderEventStream()

      // Get the scroll container
      const container = screen.getByRole("log")

      // Mock scroll position to simulate being scrolled up
      Object.defineProperty(container, "scrollHeight", { value: 2000 })
      Object.defineProperty(container, "scrollTop", { value: 0 })
      Object.defineProperty(container, "clientHeight", { value: 500 })

      // Trigger wheel event (user scrolling)
      fireEvent.wheel(container)
      // Trigger scroll event
      fireEvent.scroll(container)

      // Now the button should appear
      expect(screen.getByLabelText("Scroll to latest events")).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      const { container } = render(<EventStream className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("instanceId filtering", () => {
    it("shows events from active instance when instanceId is not provided", () => {
      // Add an event to the default/active instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Active instance message",
      })

      renderEventStream()
      expect(screen.getByText("Active instance message")).toBeInTheDocument()
    })

    it("shows events from specified instance when instanceId is provided", () => {
      // Create a second instance
      useAppStore.getState().createInstance("instance-2", "Second Instance")

      // Add events to the second instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Instance 2 message",
      })

      // Switch back to default instance
      useAppStore.getState().setActiveInstanceId(DEFAULT_INSTANCE_ID)

      // Add an event to the default instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Default instance message",
      })

      // Render with instanceId pointing to instance-2
      renderEventStream({ instanceId: "instance-2" })

      // Should show instance-2's message
      expect(screen.getByText("Instance 2 message")).toBeInTheDocument()
      // Should NOT show default instance's message
      expect(screen.queryByText("Default instance message")).not.toBeInTheDocument()
    })

    it("shows empty state when specified instance has no events", () => {
      // Create a second instance (empty)
      useAppStore.getState().createInstance("empty-instance", "Empty Instance")
      useAppStore.getState().setActiveInstanceId(DEFAULT_INSTANCE_ID)

      // Add event to default instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Default message",
      })

      // Render with instanceId pointing to the empty instance
      renderEventStream({ instanceId: "empty-instance" })

      // Should show empty state
      expect(screen.getByText("No events yet")).toBeInTheDocument()
      expect(screen.queryByText("Default message")).not.toBeInTheDocument()
    })

    it("shows status from specified instance when instanceId is provided", () => {
      // Create a second instance
      useAppStore.getState().createInstance("running-instance", "Running Instance")

      // Add an event to make it non-empty
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })

      // Set the second instance as running
      useAppStore.getState().setRalphStatus("running")

      // Switch back to default instance (which should be stopped)
      useAppStore.getState().setActiveInstanceId(DEFAULT_INSTANCE_ID)

      // Render with instanceId pointing to the running instance
      renderEventStream({ instanceId: "running-instance" })

      // Should show the running spinner because we're viewing the running instance
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
    })

    it("uses active instance events when instanceId is undefined", () => {
      // Add events to default instance
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "First message",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001000,
        message: "Second message",
      })

      // Render without instanceId (should use active instance)
      renderEventStream({ instanceId: undefined })

      expect(screen.getByText("First message")).toBeInTheDocument()
      expect(screen.getByText("Second message")).toBeInTheDocument()
    })
  })

  describe("running spinner", () => {
    it("shows spinner when Ralph is running", () => {
      useAppStore.getState().setRalphStatus("running")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      renderEventStream()
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
      expect(screen.getByLabelText("Ralph is running")).toBeInTheDocument()
    })

    it("shows spinner when Ralph is starting", () => {
      useAppStore.getState().setRalphStatus("starting")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      renderEventStream()
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
    })

    it("does not show spinner when Ralph is stopped", () => {
      useAppStore.getState().setRalphStatus("stopped")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      renderEventStream()
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })

    it("does not show spinner when Ralph is paused", () => {
      useAppStore.getState().setRalphStatus("paused")
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000000,
        message: "Test message",
      })
      renderEventStream()
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })

    it("does not show spinner when there are no events (empty state)", () => {
      useAppStore.getState().setRalphStatus("running")
      renderEventStream()
      // Empty state shows "No events yet" instead
      expect(screen.getByText("No events yet")).toBeInTheDocument()
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })

    it("does not show spinner when viewing a completed iteration", () => {
      // Add two iteration boundaries
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000500,
        message: "First iteration message",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001500,
        message: "Second iteration message",
      })

      // Set Ralph as running
      useAppStore.getState().setRalphStatus("running")

      // Navigate to the first (completed) iteration
      useAppStore.getState().setViewingIterationIndex(0)

      renderEventStream()

      // Should show the first iteration's message
      expect(screen.getByText("First iteration message")).toBeInTheDocument()
      expect(screen.queryByText("Second iteration message")).not.toBeInTheDocument()

      // Should NOT show spinner because we're viewing a completed iteration
      expect(screen.queryByTestId("ralph-running-spinner")).not.toBeInTheDocument()
    })

    it("shows spinner when viewing latest iteration and Ralph is running", () => {
      // Add two iteration boundaries
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600000000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600000500,
        message: "First iteration message",
      })
      useAppStore.getState().addEvent({
        type: "system",
        timestamp: 1705600001000,
        subtype: "init",
      })
      useAppStore.getState().addEvent({
        type: "user_message",
        timestamp: 1705600001500,
        message: "Second iteration message",
      })

      // Set Ralph as running
      useAppStore.getState().setRalphStatus("running")

      // Keep viewing the latest iteration (default)
      // viewingIterationIndex should be null (latest)

      renderEventStream()

      // Should show the second iteration's message
      expect(screen.getByText("Second iteration message")).toBeInTheDocument()

      // Should show spinner because we're viewing latest and Ralph is running
      expect(screen.getByTestId("ralph-running-spinner")).toBeInTheDocument()
    })
  })
})
