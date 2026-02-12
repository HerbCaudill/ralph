import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { StatusIndicator } from "../StatusIndicator"

describe("StatusIndicator", () => {
  describe("when idle (stopped)", () => {
    it('shows "Stopped" text', () => {
      render(<StatusIndicator controlState="idle" />)
      expect(screen.getByText("Stopped")).toBeInTheDocument()
    })

    it("has correct status dot color class", () => {
      render(<StatusIndicator controlState="idle" />)
      const dot = screen.getByTestId("status-indicator-dot")
      expect(dot).toHaveClass("bg-status-neutral")
    })
  })

  describe("when running", () => {
    it('shows "Running" text', () => {
      render(<StatusIndicator controlState="running" />)
      expect(screen.getByText("Running")).toBeInTheDocument()
    })

    it("has correct status dot color class", () => {
      render(<StatusIndicator controlState="running" />)
      const dot = screen.getByTestId("status-indicator-dot")
      expect(dot).toHaveClass("bg-status-success")
    })
  })

  describe("when paused", () => {
    it('shows "Paused" text', () => {
      render(<StatusIndicator controlState="paused" />)
      expect(screen.getByText("Paused")).toBeInTheDocument()
    })

    it("has correct status dot color class", () => {
      render(<StatusIndicator controlState="paused" />)
      const dot = screen.getByTestId("status-indicator-dot")
      expect(dot).toHaveClass("bg-status-warning")
    })
  })

  describe("when stopping after current", () => {
    it('shows "Stopping after task" text', () => {
      render(<StatusIndicator controlState="running" isStoppingAfterCurrent />)
      expect(screen.getByText("Stopping after task")).toBeInTheDocument()
    })

    it("has correct status dot color class", () => {
      render(<StatusIndicator controlState="running" isStoppingAfterCurrent />)
      const dot = screen.getByTestId("status-indicator-dot")
      expect(dot).toHaveClass("bg-status-warning")
    })

    it("does not animate the dot", () => {
      render(<StatusIndicator controlState="running" isStoppingAfterCurrent />)
      const dot = screen.getByTestId("status-indicator-dot")
      expect(dot).not.toHaveClass("animate-pulse")
    })
  })

  describe("accessibility", () => {
    it("has title attribute showing full status", () => {
      render(<StatusIndicator controlState="running" />)
      const container = screen.getByTestId("status-indicator")
      expect(container).toHaveAttribute("title", "Running")
    })

    it("shows full status in title for stopping after current", () => {
      render(<StatusIndicator controlState="running" isStoppingAfterCurrent />)
      const container = screen.getByTestId("status-indicator")
      expect(container).toHaveAttribute("title", "Stopping after task")
    })
  })

  describe("custom className", () => {
    it("applies custom className", () => {
      render(<StatusIndicator controlState="idle" className="custom-class" />)
      const container = screen.getByTestId("status-indicator")
      expect(container).toHaveClass("custom-class")
    })
  })
})
