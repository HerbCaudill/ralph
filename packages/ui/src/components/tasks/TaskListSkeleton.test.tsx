import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskListSkeleton } from "./TaskListSkeleton"

describe("TaskListSkeleton", () => {
  it("renders with correct accessibility attributes", () => {
    render(<TaskListSkeleton />)
    expect(screen.getByRole("status", { name: "Loading tasks" })).toBeInTheDocument()
  })

  it("applies custom className", () => {
    render(<TaskListSkeleton className="custom-class" />)
    expect(screen.getByRole("status")).toHaveClass("custom-class")
  })

  it("renders group header skeletons", () => {
    const { container } = render(<TaskListSkeleton />)
    // Should have skeleton elements with animate-pulse class
    const skeletonElements = container.querySelectorAll(".animate-pulse")
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it("renders task card skeletons", () => {
    const { container } = render(<TaskListSkeleton />)
    // Should have multiple skeleton rows (6 task cards based on implementation)
    const borderElements = container.querySelectorAll(".border-b")
    expect(borderElements.length).toBeGreaterThan(2)
  })
})
