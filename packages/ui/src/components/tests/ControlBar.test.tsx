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
    isStoppingAfterCurrent: false,
    onStart: vi.fn(),
    onResume: vi.fn(),
    onPause: vi.fn(),
    onStopAfterCurrent: vi.fn(),
    onCancelStopAfterCurrent: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("button rendering", () => {
    it("renders control buttons", () => {
      render(<ControlBar {...defaultProps} />)

      expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
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
    })
  })

  describe("button states when idle", () => {
    it("enables Start button when idle", () => {
      render(<ControlBar {...defaultProps} controlState="idle" />)
      expect(screen.getByRole("button", { name: "Start" })).not.toBeDisabled()
    })

    it("disables Pause button when idle", () => {
      render(<ControlBar {...defaultProps} controlState="idle" />)
      expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled()
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

  describe("button states when paused (r-57grj)", () => {
    it("shows Resume button (not Start) when paused", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument()
    })

    it("enables Resume button when paused and connected", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Resume" })).not.toBeDisabled()
    })

    it("disables Resume button when paused but disconnected", () => {
      render(<ControlBar {...defaultProps} controlState="paused" isConnected={false} />)
      expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled()
    })

    it("disables Pause button when paused", () => {
      render(<ControlBar {...defaultProps} controlState="paused" />)
      expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled()
    })
  })

  describe("Resume button action (r-57grj)", () => {
    it("calls onResume when Resume is clicked while paused", async () => {
      const onResume = vi.fn()
      render(<ControlBar {...defaultProps} controlState="paused" onResume={onResume} />)

      fireEvent.click(screen.getByRole("button", { name: "Resume" }))

      await waitFor(() => {
        expect(onResume).toHaveBeenCalledTimes(1)
      })
    })

    it("does not call onStart when Resume is clicked", async () => {
      const onStart = vi.fn()
      const onResume = vi.fn()
      render(
        <ControlBar
          {...defaultProps}
          controlState="paused"
          onStart={onStart}
          onResume={onResume}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Resume" }))

      await waitFor(() => {
        expect(onResume).toHaveBeenCalledTimes(1)
        expect(onStart).not.toHaveBeenCalled()
      })
    })
  })
})
