import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { ControlBar } from "../ControlBar"

// Mock agent-view cn utility
vi.mock("@herbcaudill/agent-view", () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" "),
}))

// Mock @herbcaudill/components to provide Button with data-slot attribute
vi.mock("@herbcaudill/components", () => ({
  Button: (allProps: Record<string, unknown>) => {
    const { className, variant, size, children, ...restProps } = allProps as {
      className?: string
      variant?: string
      size?: string
      children?: React.ReactNode
      [key: string]: unknown
    }
    return (
      <button
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={className ?? ""}
        data-debug-classname={String(className)}
        {...(restProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    )
  },
}))

describe("ControlBar", () => {
  const defaultProps = {
    controlState: "idle" as const,
    isConnected: true,
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onStopAfterCurrent: vi.fn(),
    onCancelStopAfterCurrent: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("button rendering", () => {
    it("renders all control buttons", () => {
      render(<ControlBar {...defaultProps} />)

      expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Stop after current action" })).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(<ControlBar {...defaultProps} className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("uses shared Button component with outline variant and icon-xs size", () => {
      render(<ControlBar {...defaultProps} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveAttribute("data-slot", "button")
        expect(button).toHaveAttribute("data-variant", "outline")
        expect(button).toHaveAttribute("data-size", "icon-xs")
      })
    })
  })

  describe("button states when disconnected", () => {
    it("disables all buttons when not connected", () => {
      render(<ControlBar {...defaultProps} isConnected={false} />)

      expect(screen.getByRole("button", { name: "Start" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Stop after current action" })).toBeDisabled()
    })
  })

  describe("button states when idle (stopped)", () => {
    it("enables Start button when idle", () => {
      render(<ControlBar {...defaultProps} controlState="idle" />)
      expect(screen.getByRole("button", { name: "Start" })).not.toBeDisabled()
    })

    it("disables Pause button when idle", () => {
      render(<ControlBar {...defaultProps} controlState="idle" />)
      expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled()
    })

    it("disables Stop button when idle", () => {
      render(<ControlBar {...defaultProps} controlState="idle" />)
      expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()
    })

    it("disables Stop after current button when idle", () => {
      render(<ControlBar {...defaultProps} controlState="idle" />)
      expect(screen.getByRole("button", { name: "Stop after current action" })).toBeDisabled()
    })
  })

  describe("button states when running", () => {
    it("disables Start button when running", () => {
      render(<ControlBar {...defaultProps} controlState="running" />)
      expect(screen.getByRole("button", { name: "Start" })).toBeDisabled()
    })

    it("enables Pause button when running", () => {
      render(<ControlBar {...defaultProps} controlState="running" />)
      expect(screen.getByRole("button", { name: "Pause" })).not.toBeDisabled()
    })

    it("enables Stop button when running", () => {
      render(<ControlBar {...defaultProps} controlState="running" />)
      expect(screen.getByRole("button", { name: "Stop" })).not.toBeDisabled()
    })

    it("enables Stop after current button when running", () => {
      render(<ControlBar {...defaultProps} controlState="running" />)
      expect(screen.getByRole("button", { name: "Stop after current action" })).not.toBeDisabled()
    })
  })

  describe("button states when paused", () => {
    it("disables Start button when paused", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Start" })).toBeDisabled()
    })

    it("enables Resume button when paused (button label changes)", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Resume" })).not.toBeDisabled()
    })

    it("enables Stop button when paused", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Stop" })).not.toBeDisabled()
    })

    it("enables Stop after current button when paused", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Stop after current action" })).not.toBeDisabled()
    })
  })

  describe("button states when stopping after current", () => {
    it("disables Start button when stopping after current", () => {
      render(<ControlBar {...defaultProps} controlState="running" isStoppingAfterCurrent={true} />)
      expect(screen.getByRole("button", { name: "Start" })).toBeDisabled()
    })

    it("disables Pause button when stopping after current", () => {
      render(<ControlBar {...defaultProps} controlState="running" isStoppingAfterCurrent={true} />)
      expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled()
    })

    it("enables Stop button when stopping after current", () => {
      render(<ControlBar {...defaultProps} controlState="running" isStoppingAfterCurrent={true} />)
      expect(screen.getByRole("button", { name: "Stop" })).not.toBeDisabled()
    })

    it("enables Cancel stop after current button when stopping after current", () => {
      render(<ControlBar {...defaultProps} controlState="running" isStoppingAfterCurrent={true} />)
      expect(screen.getByRole("button", { name: "Cancel stop after current" })).not.toBeDisabled()
    })
  })

  describe("Start button action", () => {
    it("calls onStart when Start is clicked", async () => {
      const onStart = vi.fn()
      render(<ControlBar {...defaultProps} controlState="idle" onStart={onStart} />)

      fireEvent.click(screen.getByRole("button", { name: "Start" }))

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("Stop button action", () => {
    it("calls onStop when Stop is clicked", async () => {
      const onStop = vi.fn()
      render(<ControlBar {...defaultProps} controlState="running" onStop={onStop} />)

      fireEvent.click(screen.getByRole("button", { name: "Stop" }))

      await waitFor(() => {
        expect(onStop).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("Pause button action", () => {
    it("calls onPause when Pause is clicked", async () => {
      const onPause = vi.fn()
      render(<ControlBar {...defaultProps} controlState="running" onPause={onPause} />)

      fireEvent.click(screen.getByRole("button", { name: "Pause" }))

      await waitFor(() => {
        expect(onPause).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("Resume button action", () => {
    it("calls onResume when Resume is clicked", async () => {
      const onResume = vi.fn()
      render(<ControlBar {...defaultProps} controlState="paused" onResume={onResume} />)

      fireEvent.click(screen.getByRole("button", { name: "Resume" }))

      await waitFor(() => {
        expect(onResume).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("Stop after current button action", () => {
    it("calls onStopAfterCurrent when Stop after current is clicked", async () => {
      const onStopAfterCurrent = vi.fn()
      render(
        <ControlBar
          {...defaultProps}
          controlState="running"
          onStopAfterCurrent={onStopAfterCurrent}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Stop after current action" }))

      await waitFor(() => {
        expect(onStopAfterCurrent).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("Cancel stop after current button action", () => {
    it("calls onCancelStopAfterCurrent when cancel button is clicked", async () => {
      const onCancelStopAfterCurrent = vi.fn()
      render(
        <ControlBar
          {...defaultProps}
          controlState="running"
          isStoppingAfterCurrent={true}
          onCancelStopAfterCurrent={onCancelStopAfterCurrent}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Cancel stop after current" }))

      await waitFor(() => {
        expect(onCancelStopAfterCurrent).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("button styling", () => {
    it("Stop button should not have hardcoded red hover color", () => {
      render(<ControlBar {...defaultProps} controlState="running" />)

      const stopButton = screen.getByRole("button", { name: "Stop" })
      const className = stopButton.className || ""
      // Should NOT have hardcoded red hover color - the outline variant provides accent-based hover
      expect(className).not.toMatch(/hover:text-red/)
    })

    it("Stop After Current button should not have hardcoded amber colors when active", () => {
      render(<ControlBar {...defaultProps} controlState="running" isStoppingAfterCurrent={true} />)

      const stopAfterCurrentButton = screen.getByRole("button", {
        name: "Cancel stop after current",
      })
      const className = stopAfterCurrentButton.className || ""
      // Should NOT have hardcoded amber colors - use repo-accent instead
      expect(className).not.toMatch(/amber/)
    })

    it("Stop After Current button uses repo-accent when active", () => {
      render(<ControlBar {...defaultProps} controlState="running" isStoppingAfterCurrent={true} />)

      const stopAfterCurrentButton = screen.getByRole("button", {
        name: "Cancel stop after current",
      })
      const classNameAttr = stopAfterCurrentButton.getAttribute("data-debug-classname")
      // Should use repo-accent for theming
      expect(classNameAttr).toContain("repo-accent")
    })
  })
})
