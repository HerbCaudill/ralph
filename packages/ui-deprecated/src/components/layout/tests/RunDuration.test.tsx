import { render, screen, act } from "@/test-utils"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { RunDuration } from ".././RunDuration"
import { useAppStore } from "@/store"

describe("RunDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAppStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not render when runStartedAt is null", () => {
    render(<RunDuration />)
    expect(screen.queryByTitle("Time running")).not.toBeInTheDocument()
  })

  it("shows elapsed time when runStartedAt is set", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    // Set status to running which sets runStartedAt
    useAppStore.getState().setRalphStatus("running")

    render(<RunDuration />)

    expect(screen.getByTitle("Time running")).toBeInTheDocument()
    expect(screen.getByText("0s")).toBeInTheDocument()
  })

  it("updates elapsed time every second", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    useAppStore.getState().setRalphStatus("running")

    render(<RunDuration />)

    expect(screen.getByText("0s")).toBeInTheDocument()

    // Advance time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText("5s")).toBeInTheDocument()
  })

  it("formats time with minutes when over 60 seconds", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    useAppStore.getState().setRalphStatus("running")

    render(<RunDuration />)

    // Advance time by 65 seconds
    act(() => {
      vi.advanceTimersByTime(65000)
    })

    expect(screen.getByText("1:05")).toBeInTheDocument()
  })

  it("formats time with hours when over 60 minutes", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    useAppStore.getState().setRalphStatus("running")

    render(<RunDuration />)

    // Advance time by 1 hour 2 minutes 3 seconds
    act(() => {
      vi.advanceTimersByTime(3723000) // 1:02:03
    })

    expect(screen.getByText("1:02:03")).toBeInTheDocument()
  })

  it("resets to 0 when runStartedAt becomes null", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    useAppStore.getState().setRalphStatus("running")

    const { rerender } = render(<RunDuration />)

    // Advance time by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(screen.getByText("10s")).toBeInTheDocument()

    // Stop Ralph
    act(() => {
      useAppStore.getState().setRalphStatus("stopped")
    })

    rerender(<RunDuration />)

    expect(screen.queryByTitle("Time running")).not.toBeInTheDocument()
  })

  it("shows clock icon", () => {
    const now = Date.now()
    vi.setSystemTime(now)

    useAppStore.getState().setRalphStatus("running")

    render(<RunDuration />)

    // The icon should be present (rendered as svg)
    const container = screen.getByTitle("Time running")
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})
