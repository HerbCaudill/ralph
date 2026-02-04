import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AutoScroll } from "../AutoScroll"

// Mock the useAutoScroll hook
vi.mock("../../hooks/useAutoScroll", () => ({
  useAutoScroll: () => ({
    containerRef: { current: null },
    isAtBottom: true,
    handleScroll: vi.fn(),
    handleUserScroll: vi.fn(),
    scrollToBottom: vi.fn(),
  }),
}))

describe("AutoScroll", () => {
  describe("layout in flex container", () => {
    it("uses flex-1 and min-h-0 to properly fill remaining space in flex parent", () => {
      /**
       * When AutoScroll is used inside a flex container with a header above it,
       * it should use flex-1 (to fill remaining space) and min-h-0 (to allow shrinking).
       * Using h-full instead would cause overflow issues when there's a sibling header.
       */
      const { container } = render(
        <div className="flex h-screen flex-col">
          <header className="h-16">Header</header>
          <AutoScroll ariaLabel="Test content">
            <div>Content</div>
          </AutoScroll>
        </div>,
      )

      const autoScrollWrapper = container.querySelector('[role="log"]')?.parentElement
      expect(autoScrollWrapper).not.toBeNull()

      // Should have flex-1 to fill remaining space (not h-full which would overflow)
      expect(autoScrollWrapper?.className).toContain("flex-1")
      // Should have min-h-0 to allow shrinking below content size
      expect(autoScrollWrapper?.className).toContain("min-h-0")
      // Should NOT have h-full which causes overflow when siblings exist
      expect(autoScrollWrapper?.className).not.toContain("h-full")
    })

    it("renders children inside scrollable container", () => {
      render(
        <AutoScroll ariaLabel="Test content">
          <div data-testid="child-content">Test child</div>
        </AutoScroll>,
      )

      expect(screen.getByTestId("child-content")).toBeInTheDocument()
    })

    it("renders empty state when no children", () => {
      render(
        <AutoScroll ariaLabel="Test content" emptyState={<div data-testid="empty">Empty</div>}>
          {null}
        </AutoScroll>,
      )

      expect(screen.getByTestId("empty")).toBeInTheDocument()
    })
  })
})
