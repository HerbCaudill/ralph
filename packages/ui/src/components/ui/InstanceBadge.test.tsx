import { render, screen } from "@/test-utils"
import { describe, it, expect } from "vitest"
import { InstanceBadge } from "./InstanceBadge"

describe("InstanceBadge", () => {
  describe("status display", () => {
    it("shows 'Stopped' for stopped status", () => {
      render(<InstanceBadge status="stopped" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Stopped")
    })

    it("shows 'Starting' for starting status", () => {
      render(<InstanceBadge status="starting" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Starting")
    })

    it("shows 'Running' for running status", () => {
      render(<InstanceBadge status="running" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Running")
    })

    it("shows 'Pausing' for pausing status", () => {
      render(<InstanceBadge status="pausing" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Pausing")
    })

    it("shows 'Paused' for paused status", () => {
      render(<InstanceBadge status="paused" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Paused")
    })

    it("shows 'Stopping' for stopping status", () => {
      render(<InstanceBadge status="stopping" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Stopping")
    })

    it("shows 'Stopping after task' for stopping_after_current status", () => {
      render(<InstanceBadge status="stopping_after_current" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Stopping after task")
    })
  })

  describe("name display", () => {
    it("shows name with status when name is provided", () => {
      render(<InstanceBadge status="running" name="Main" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Main - Running")
    })

    it("shows only status when name is not provided", () => {
      render(<InstanceBadge status="running" />)
      expect(screen.getByTestId("instance-badge-label")).toHaveTextContent("Running")
      expect(screen.getByTestId("instance-badge-label")).not.toHaveTextContent(" - ")
    })

    it("sets title attribute with name and status", () => {
      render(<InstanceBadge status="paused" name="Worktree 1" />)
      expect(screen.getByTestId("instance-badge")).toHaveAttribute("title", "Worktree 1 - Paused")
    })
  })

  describe("showLabel prop", () => {
    it("shows label by default", () => {
      render(<InstanceBadge status="running" />)
      expect(screen.getByTestId("instance-badge-label")).toBeInTheDocument()
    })

    it("hides label when showLabel is false", () => {
      render(<InstanceBadge status="running" showLabel={false} />)
      expect(screen.queryByTestId("instance-badge-label")).not.toBeInTheDocument()
    })

    it("still shows indicator when showLabel is false", () => {
      render(<InstanceBadge status="running" showLabel={false} />)
      expect(screen.getByTestId("instance-badge-indicator")).toBeInTheDocument()
    })

    it("still has title for tooltip when showLabel is false", () => {
      render(<InstanceBadge status="running" name="Test" showLabel={false} />)
      expect(screen.getByTestId("instance-badge")).toHaveAttribute("title", "Test - Running")
    })
  })

  describe("styling", () => {
    it("applies custom className", () => {
      render(<InstanceBadge status="running" className="custom-class" />)
      expect(screen.getByTestId("instance-badge")).toHaveClass("custom-class")
    })

    it("has flex layout with gap", () => {
      render(<InstanceBadge status="running" />)
      const badge = screen.getByTestId("instance-badge")
      expect(badge).toHaveClass("flex")
      expect(badge).toHaveClass("items-center")
      expect(badge).toHaveClass("gap-1.5")
    })

    it("indicator is a small circle", () => {
      render(<InstanceBadge status="running" />)
      const indicator = screen.getByTestId("instance-badge-indicator")
      expect(indicator).toHaveClass("size-2")
      expect(indicator).toHaveClass("rounded-full")
    })
  })
})
