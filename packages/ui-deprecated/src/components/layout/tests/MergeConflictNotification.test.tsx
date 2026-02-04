import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MergeConflictNotification } from ".././MergeConflictNotification"
import { useAppStore } from "@/store"

describe("MergeConflictNotification", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it("renders nothing when there is no merge conflict", () => {
    const { container } = render(<MergeConflictNotification />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when active instance has no merge conflict", () => {
    // Create an instance without a merge conflict
    useAppStore.getState().createInstance("test-id", "Test Instance", "Ralph-1")
    useAppStore.getState().setActiveInstanceId("test-id")

    const { container } = render(<MergeConflictNotification />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders notification when active instance has a merge conflict", () => {
    // Create an instance with a merge conflict
    useAppStore.getState().createInstance("test-id", "Test Instance", "Ralph-1")
    useAppStore.getState().setActiveInstanceId("test-id")
    useAppStore.getState().setMergeConflictForInstance("test-id", {
      files: ["file1.ts", "file2.ts"],
      sourceBranch: "ralph/test-id",
      timestamp: Date.now(),
    })

    render(<MergeConflictNotification />)

    expect(screen.getByTestId("merge-conflict-notification")).toBeInTheDocument()
    expect(screen.getByText(/Test Instance/)).toBeInTheDocument()
    expect(screen.getByText(/2 files/)).toBeInTheDocument()
  })

  it("shows '1 file' when there is a single conflicted file", () => {
    useAppStore.getState().createInstance("test-id", "Test Instance", "Ralph-1")
    useAppStore.getState().setActiveInstanceId("test-id")
    useAppStore.getState().setMergeConflictForInstance("test-id", {
      files: ["file1.ts"],
      sourceBranch: "ralph/test-id",
      timestamp: Date.now(),
    })

    render(<MergeConflictNotification />)

    expect(screen.getByText(/1 file/)).toBeInTheDocument()
  })

  it("does not render when a different instance has a merge conflict", () => {
    // Create two instances, only one with a merge conflict
    useAppStore.getState().createInstance("instance-1", "Instance 1", "Ralph-1")
    useAppStore.getState().createInstance("instance-2", "Instance 2", "Ralph-2")
    useAppStore.getState().setActiveInstanceId("instance-1")
    useAppStore.getState().setMergeConflictForInstance("instance-2", {
      files: ["file1.ts"],
      sourceBranch: "ralph/instance-2",
      timestamp: Date.now(),
    })

    const { container } = render(<MergeConflictNotification />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders when switching to an instance with a merge conflict", () => {
    // Create two instances, only one with a merge conflict
    useAppStore.getState().createInstance("instance-1", "Instance 1", "Ralph-1")
    useAppStore.getState().createInstance("instance-2", "Instance 2", "Ralph-2")
    useAppStore.getState().setActiveInstanceId("instance-1")
    useAppStore.getState().setMergeConflictForInstance("instance-2", {
      files: ["file1.ts"],
      sourceBranch: "ralph/instance-2",
      timestamp: Date.now(),
    })

    const { container, rerender } = render(<MergeConflictNotification />)
    expect(container).toBeEmptyDOMElement()

    // Switch to instance with merge conflict
    useAppStore.getState().setActiveInstanceId("instance-2")
    rerender(<MergeConflictNotification />)

    expect(screen.getByTestId("merge-conflict-notification")).toBeInTheDocument()
    expect(screen.getByText(/Instance 2/)).toBeInTheDocument()
  })

  it("stops rendering when merge conflict is cleared", () => {
    useAppStore.getState().createInstance("test-id", "Test Instance", "Ralph-1")
    useAppStore.getState().setActiveInstanceId("test-id")
    useAppStore.getState().setMergeConflictForInstance("test-id", {
      files: ["file1.ts"],
      sourceBranch: "ralph/test-id",
      timestamp: Date.now(),
    })

    const { container, rerender } = render(<MergeConflictNotification />)
    expect(screen.getByTestId("merge-conflict-notification")).toBeInTheDocument()

    // Clear the merge conflict
    useAppStore.getState().clearMergeConflictForInstance("test-id")
    rerender(<MergeConflictNotification />)

    expect(container).toBeEmptyDOMElement()
  })

  it("applies custom textColor", () => {
    useAppStore.getState().createInstance("test-id", "Test Instance", "Ralph-1")
    useAppStore.getState().setActiveInstanceId("test-id")
    useAppStore.getState().setMergeConflictForInstance("test-id", {
      files: ["file1.ts"],
      sourceBranch: "ralph/test-id",
      timestamp: Date.now(),
    })

    render(<MergeConflictNotification textColor="#ffffff" />)

    const textElement = screen.getByText(/Test Instance/).closest("span")
    expect(textElement).toHaveStyle({ color: "#ffffff" })
  })

  it("applies custom className", () => {
    useAppStore.getState().createInstance("test-id", "Test Instance", "Ralph-1")
    useAppStore.getState().setActiveInstanceId("test-id")
    useAppStore.getState().setMergeConflictForInstance("test-id", {
      files: ["file1.ts"],
      sourceBranch: "ralph/test-id",
      timestamp: Date.now(),
    })

    render(<MergeConflictNotification className="custom-class" />)

    expect(screen.getByTestId("merge-conflict-notification")).toHaveClass("custom-class")
  })
})
