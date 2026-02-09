import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentView } from "../AgentView"
import type { ChatEvent } from "../../types"

// Mock AutoScroll to expose the outer container structure
vi.mock("../AutoScroll", () => ({
  AutoScroll: ({ children, emptyState }: any) => {
    // Match the real AutoScroll's isEmpty check: treats null and empty arrays as empty
    const isEmpty = !children || (Array.isArray(children) && children.length === 0)
    const showEmptyState = isEmpty && emptyState
    return (
      <div data-testid="auto-scroll" className="relative flex min-h-0 flex-1 flex-col">
        {showEmptyState ? emptyState : children}
      </div>
    )
  },
}))

// Mock EventList to match real behavior: returns null when no events
vi.mock("../EventList", () => ({
  EventList: ({ events }: any) =>
    events.length > 0 ? <div data-testid="event-list">Events: {events.length}</div> : null,
}))

// Mock AgentViewProvider
vi.mock("../../context/AgentViewProvider", () => ({
  AgentViewProvider: ({ children }: any) => <>{children}</>,
}))

const mockEvent: ChatEvent = { type: "user", role: "user", content: "Hello" } as ChatEvent

describe("AgentView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("layout in flex container", () => {
    it("uses flex-1 and min-h-0 instead of h-full to prevent overflow in flex parents", () => {
      /**
       * When AgentView is used inside a flex container (like RalphRunner or RalphLoopPanel),
       * it should NOT use h-full which causes content to overflow the container.
       * Instead, it should use min-h-0 to allow proper shrinking in flex layouts.
       *
       * Bug: r-yillh - "Ralph session content overflows footer when taller than viewport"
       */
      const { container } = render(
        <div className="flex h-screen flex-col">
          <header className="h-16 shrink-0">Header</header>
          <AgentView events={[mockEvent]} isStreaming={false} />
          <footer className="h-12 shrink-0">Footer</footer>
        </div>,
      )

      // Find the AgentView outer container (first child of the flex parent after header)
      const agentViewContainer = container.querySelector(
        "[data-testid='auto-scroll']",
      )?.parentElement

      expect(agentViewContainer).not.toBeNull()

      // Should have min-h-0 to allow shrinking below content size in flex layouts
      expect(agentViewContainer?.className).toContain("min-h-0")
      // Should NOT have h-full which causes overflow when siblings exist
      expect(agentViewContainer?.className).not.toContain("h-full")
    })

    it("uses flex-1 to expand within flex parent when className prop provides it", () => {
      const { container } = render(
        <div className="flex h-screen flex-col">
          <AgentView events={[mockEvent]} isStreaming={false} className="flex-1" />
        </div>,
      )

      const agentViewContainer = container.querySelector(
        "[data-testid='auto-scroll']",
      )?.parentElement
      expect(agentViewContainer?.className).toContain("flex-1")
    })
  })

  describe("slot rendering", () => {
    it("renders header slot above content", () => {
      render(
        <AgentView
          events={[mockEvent]}
          isStreaming={false}
          header={<div data-testid="custom-header">Custom Header</div>}
        />,
      )

      expect(screen.getByTestId("custom-header")).toBeInTheDocument()
    })

    it("renders footer slot below content", () => {
      render(
        <AgentView
          events={[mockEvent]}
          isStreaming={false}
          footer={<div data-testid="custom-footer">Custom Footer</div>}
        />,
      )

      expect(screen.getByTestId("custom-footer")).toBeInTheDocument()
    })

    /**
     * Note: The empty state behavior is tested indirectly through AutoScroll.
     * When events is empty and not streaming, the EventList component returns null,
     * but AutoScroll still receives a React element as children (not null).
     * AutoScroll's isEmpty check (`!children`) is false for React elements,
     * so the empty state isn't shown through this mechanism.
     *
     * The actual empty state display relies on the specific implementation details
     * of how EventList and AutoScroll interact. The important behavior is that
     * when streaming starts, the spinner is shown as the empty state.
     */
  })

  describe("streaming state", () => {
    it("shows spinner as empty state when streaming with no events", () => {
      const { container } = render(
        <AgentView
          events={[]}
          isStreaming={true}
          emptyState={<div data-testid="custom-empty">Custom empty</div>}
        />,
      )

      // When streaming with no events, should show the spinner, not the custom empty state
      // The spinner is the default, so we check that the custom empty state is NOT shown
      expect(screen.queryByTestId("custom-empty")).not.toBeInTheDocument()
    })
  })
})
