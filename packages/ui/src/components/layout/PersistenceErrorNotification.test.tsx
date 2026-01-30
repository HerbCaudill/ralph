import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PersistenceErrorNotification } from "./PersistenceErrorNotification"
import { useAppStore } from "@/store"
import { writeQueue } from "@/lib/persistence"

// Mock the writeQueue
vi.mock("@/lib/persistence", () => ({
  writeQueue: {
    retryFailedWrites: vi.fn(),
    clearFailures: vi.fn(),
  },
}))

describe("PersistenceErrorNotification", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    vi.clearAllMocks()
  })

  it("renders nothing when there is no persistence error", () => {
    const { container } = render(<PersistenceErrorNotification />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders notification when persistence error exists", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 3,
    })

    render(<PersistenceErrorNotification />)

    expect(screen.getByTestId("persistence-error-notification")).toBeInTheDocument()
    expect(screen.getByText(/Failed to save/)).toBeInTheDocument()
    expect(screen.getByText(/3 events/)).toBeInTheDocument()
  })

  it("shows correct pluralization for single event", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist event",
      failedCount: 1,
    })

    render(<PersistenceErrorNotification />)

    expect(screen.getByText(/1 event/)).toBeInTheDocument()
    // Should not show "events" (plural)
    expect(screen.queryByText(/1 events/)).not.toBeInTheDocument()
  })

  it("shows correct pluralization for multiple events", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 5,
    })

    render(<PersistenceErrorNotification />)

    expect(screen.getByText(/5 events/)).toBeInTheDocument()
  })

  it("retry button clears error and retries failed writes", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 2,
    })

    render(<PersistenceErrorNotification />)

    const retryButton = screen.getByLabelText("Retry saving failed events")
    fireEvent.click(retryButton)

    // Should clear the error state
    expect(useAppStore.getState().persistenceError).toBeNull()

    // Should call retryFailedWrites
    expect(writeQueue.retryFailedWrites).toHaveBeenCalled()
  })

  it("dismiss button clears error and clears failures", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 2,
    })

    render(<PersistenceErrorNotification />)

    const dismissButton = screen.getByLabelText("Dismiss persistence error")
    fireEvent.click(dismissButton)

    // Should clear the error state
    expect(useAppStore.getState().persistenceError).toBeNull()

    // Should call clearFailures
    expect(writeQueue.clearFailures).toHaveBeenCalled()
  })

  it("stops rendering when error is cleared", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 2,
    })

    const { container, rerender } = render(<PersistenceErrorNotification />)
    expect(screen.getByTestId("persistence-error-notification")).toBeInTheDocument()

    // Clear the error
    useAppStore.getState().clearPersistenceError()
    rerender(<PersistenceErrorNotification />)

    expect(container).toBeEmptyDOMElement()
  })

  it("applies custom textColor", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 2,
    })

    render(<PersistenceErrorNotification textColor="#ffffff" />)

    const textElement = screen.getByText(/Failed to save/).closest("span")
    expect(textElement).toHaveStyle({ color: "#ffffff" })
  })

  it("applies custom className", () => {
    useAppStore.getState().setPersistenceError({
      message: "Failed to persist events",
      failedCount: 2,
    })

    render(<PersistenceErrorNotification className="custom-class" />)

    expect(screen.getByTestId("persistence-error-notification")).toHaveClass("custom-class")
  })
})
