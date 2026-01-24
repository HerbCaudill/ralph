import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskDialogProvider, useTaskDialogContext } from "./TaskDialogContext"

// Test component that uses the context
function TestConsumer() {
  const context = useTaskDialogContext()
  if (!context) {
    return <span>No context</span>
  }
  return <button onClick={() => context.openTaskById("test-123")}>Open Task</button>
}

describe("TaskDialogContext", () => {
  describe("useTaskDialogContext", () => {
    it("returns null when used outside provider", () => {
      render(<TestConsumer />)
      expect(screen.getByText("No context")).toBeInTheDocument()
    })

    it("returns context value when used inside provider", () => {
      const openTaskById = vi.fn()
      render(
        <TaskDialogProvider openTaskById={openTaskById}>
          <TestConsumer />
        </TaskDialogProvider>,
      )

      expect(screen.queryByText("No context")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Open Task" })).toBeInTheDocument()
    })
  })

  describe("TaskDialogProvider", () => {
    it("provides openTaskById function to children", () => {
      const openTaskById = vi.fn()
      render(
        <TaskDialogProvider openTaskById={openTaskById}>
          <TestConsumer />
        </TaskDialogProvider>,
      )

      fireEvent.click(screen.getByRole("button", { name: "Open Task" }))

      expect(openTaskById).toHaveBeenCalledWith("test-123")
      expect(openTaskById).toHaveBeenCalledTimes(1)
    })

    it("renders children correctly", () => {
      render(
        <TaskDialogProvider openTaskById={vi.fn()}>
          <div data-testid="child">Child content</div>
        </TaskDialogProvider>,
      )

      expect(screen.getByTestId("child")).toHaveTextContent("Child content")
    })
  })
})
