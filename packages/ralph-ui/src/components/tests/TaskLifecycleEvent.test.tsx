import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskLifecycleEvent } from "../TaskLifecycleEvent"
import type { TaskLifecycleChatEvent } from "@herbcaudill/ralph-shared"

describe("TaskLifecycleEvent", () => {
  describe("starting state", () => {
    const startingEvent: TaskLifecycleChatEvent = {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "starting",
      taskId: "r-abc123",
    }

    it("renders the starting label", () => {
      render(<TaskLifecycleEvent event={startingEvent} />)
      expect(screen.getByText("Starting")).toBeInTheDocument()
    })

    it("renders the task ID", () => {
      render(<TaskLifecycleEvent event={startingEvent} />)
      expect(screen.getByText("r-abc123")).toBeInTheDocument()
    })

    it("has starting test attribute", () => {
      render(<TaskLifecycleEvent event={startingEvent} />)
      const element = screen.getByTestId("task-lifecycle-event")
      expect(element).toHaveAttribute("data-action", "starting")
    })

    it("uses blue styling for starting state", () => {
      render(<TaskLifecycleEvent event={startingEvent} />)
      const element = screen.getByTestId("task-lifecycle-event")
      expect(element).toHaveClass("border-blue-500")
    })
  })

  describe("completed state", () => {
    const completedEvent: TaskLifecycleChatEvent = {
      type: "task_lifecycle",
      timestamp: Date.now(),
      action: "completed",
      taskId: "r-xyz789",
    }

    it("renders the completed label", () => {
      render(<TaskLifecycleEvent event={completedEvent} />)
      expect(screen.getByText("Completed")).toBeInTheDocument()
    })

    it("renders the task ID", () => {
      render(<TaskLifecycleEvent event={completedEvent} />)
      expect(screen.getByText("r-xyz789")).toBeInTheDocument()
    })

    it("has completed test attribute", () => {
      render(<TaskLifecycleEvent event={completedEvent} />)
      const element = screen.getByTestId("task-lifecycle-event")
      expect(element).toHaveAttribute("data-action", "completed")
    })

    it("uses green styling for completed state", () => {
      render(<TaskLifecycleEvent event={completedEvent} />)
      const element = screen.getByTestId("task-lifecycle-event")
      expect(element).toHaveClass("border-green-500")
    })
  })

  describe("subtask IDs", () => {
    it("renders subtask IDs correctly", () => {
      const subtaskEvent: TaskLifecycleChatEvent = {
        type: "task_lifecycle",
        timestamp: Date.now(),
        action: "starting",
        taskId: "r-abc123.5",
      }
      render(<TaskLifecycleEvent event={subtaskEvent} />)
      expect(screen.getByText("r-abc123.5")).toBeInTheDocument()
    })

    it("renders deeply nested subtask IDs", () => {
      const deepSubtaskEvent: TaskLifecycleChatEvent = {
        type: "task_lifecycle",
        timestamp: Date.now(),
        action: "completed",
        taskId: "r-abc123.5.2",
      }
      render(<TaskLifecycleEvent event={deepSubtaskEvent} />)
      expect(screen.getByText("r-abc123.5.2")).toBeInTheDocument()
    })
  })
})
