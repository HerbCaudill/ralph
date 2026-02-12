import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { WorkerControlBar, type WorkerInfo } from "../WorkerControlBar"

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
        {...(restProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    )
  },
}))

describe("WorkerControlBar", () => {
  const mockWorkers: WorkerInfo[] = [
    { workerName: "homer", state: "running", currentWorkId: "bd-abc123" },
    { workerName: "marge", state: "paused", currentWorkId: "bd-def456" },
  ]

  const defaultProps = {
    workers: mockWorkers,
    isConnected: true,
    isStoppingAfterCurrent: false,
    onPauseWorker: vi.fn(),
    onResumeWorker: vi.fn(),
    onStopWorker: vi.fn(),
    onStopAfterCurrent: vi.fn(),
    onCancelStopAfterCurrent: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders nothing when there are no workers", () => {
      const { container } = render(<WorkerControlBar {...defaultProps} workers={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it("renders worker rows for each worker", () => {
      render(<WorkerControlBar {...defaultProps} />)

      expect(screen.getByText("homer")).toBeInTheDocument()
      expect(screen.getByText("marge")).toBeInTheDocument()
    })

    it("shows task IDs for workers", () => {
      render(<WorkerControlBar {...defaultProps} />)

      expect(screen.getByText("bd-abc123")).toBeInTheDocument()
      expect(screen.getByText("bd-def456")).toBeInTheDocument()
    })

    it("shows worker states", () => {
      render(<WorkerControlBar {...defaultProps} />)

      expect(screen.getByText("running")).toBeInTheDocument()
      expect(screen.getByText("paused")).toBeInTheDocument()
    })
  })

  describe("global controls", () => {
    it("shows Stop All button", () => {
      render(<WorkerControlBar {...defaultProps} />)

      expect(screen.getByRole("button", { name: /stop all/i })).toBeInTheDocument()
    })

    it("shows Cancel Stop button when stopping", () => {
      render(<WorkerControlBar {...defaultProps} isStoppingAfterCurrent={true} />)

      expect(screen.getByRole("button", { name: /cancel stop/i })).toBeInTheDocument()
    })

    it("calls onStopAfterCurrent when Stop All is clicked", () => {
      const onStopAfterCurrent = vi.fn()
      render(<WorkerControlBar {...defaultProps} onStopAfterCurrent={onStopAfterCurrent} />)

      fireEvent.click(screen.getByRole("button", { name: /stop all/i }))

      expect(onStopAfterCurrent).toHaveBeenCalledTimes(1)
    })

    it("calls onCancelStopAfterCurrent when Cancel Stop is clicked", () => {
      const onCancelStopAfterCurrent = vi.fn()
      render(
        <WorkerControlBar
          {...defaultProps}
          isStoppingAfterCurrent={true}
          onCancelStopAfterCurrent={onCancelStopAfterCurrent}
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: /cancel stop/i }))

      expect(onCancelStopAfterCurrent).toHaveBeenCalledTimes(1)
    })
  })

  describe("per-worker controls", () => {
    it("calls onPauseWorker when pause is clicked on running worker", () => {
      const onPauseWorker = vi.fn()
      render(<WorkerControlBar {...defaultProps} onPauseWorker={onPauseWorker} />)

      fireEvent.click(screen.getByRole("button", { name: "Pause homer" }))

      expect(onPauseWorker).toHaveBeenCalledWith("homer")
    })

    it("calls onResumeWorker when resume is clicked on paused worker", () => {
      const onResumeWorker = vi.fn()
      render(<WorkerControlBar {...defaultProps} onResumeWorker={onResumeWorker} />)

      fireEvent.click(screen.getByRole("button", { name: "Resume marge" }))

      expect(onResumeWorker).toHaveBeenCalledWith("marge")
    })

    it("calls onStopWorker when stop is clicked", () => {
      const onStopWorker = vi.fn()
      render(<WorkerControlBar {...defaultProps} onStopWorker={onStopWorker} />)

      fireEvent.click(screen.getByRole("button", { name: "Stop homer" }))

      expect(onStopWorker).toHaveBeenCalledWith("homer")
    })
  })

  describe("disabled states", () => {
    it("disables controls when not connected", () => {
      render(<WorkerControlBar {...defaultProps} isConnected={false} />)

      expect(screen.getByRole("button", { name: "Pause homer" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Resume marge" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Stop homer" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Stop marge" })).toBeDisabled()
    })

    it("disables pause on paused worker", () => {
      const pausedWorkers: WorkerInfo[] = [
        { workerName: "homer", state: "paused", currentWorkId: null },
      ]
      render(<WorkerControlBar {...defaultProps} workers={pausedWorkers} />)

      // The button is disabled because it's already paused
      expect(screen.getByRole("button", { name: "Resume homer" })).not.toBeDisabled()
    })

    it("disables stop on idle worker", () => {
      const idleWorkers: WorkerInfo[] = [
        { workerName: "homer", state: "idle", currentWorkId: null },
      ]
      render(<WorkerControlBar {...defaultProps} workers={idleWorkers} />)

      expect(screen.getByRole("button", { name: "Stop homer" })).toBeDisabled()
    })
  })
})
