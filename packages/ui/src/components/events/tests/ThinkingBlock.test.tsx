import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ThinkingBlock } from "@herbcaudill/agent-view"

describe("ThinkingBlock", () => {
  describe("rendering", () => {
    it("renders the header with brain icon and 'Thinking...' text", () => {
      render(<ThinkingBlock content="Some thinking content" />)

      expect(screen.getByText("Thinking...")).toBeInTheDocument()
      // The button should be present
      expect(screen.getByRole("button")).toBeInTheDocument()
    })

    it("is collapsed by default", () => {
      render(<ThinkingBlock content="Some thinking content" />)

      // Content should not be visible when collapsed
      expect(screen.queryByText("Some thinking content")).not.toBeInTheDocument()
    })

    it("shows chevron right icon when collapsed", () => {
      const { container } = render(<ThinkingBlock content="Some thinking content" />)

      // Check for the presence of the right chevron (collapsed state)
      const svgIcons = container.querySelectorAll("svg")
      expect(svgIcons.length).toBeGreaterThan(0)
    })
  })

  describe("expand/collapse behavior", () => {
    it("expands when clicking the header button", () => {
      render(<ThinkingBlock content="Some thinking content" />)

      // Initially collapsed - content not visible
      expect(screen.queryByText("Some thinking content")).not.toBeInTheDocument()

      // Click the button to expand
      fireEvent.click(screen.getByRole("button"))

      // Now content should be visible
      expect(screen.getByText("Some thinking content")).toBeInTheDocument()
    })

    it("collapses when clicking the header button again", () => {
      render(<ThinkingBlock content="Some thinking content" />)

      // Expand first
      fireEvent.click(screen.getByRole("button"))
      expect(screen.getByText("Some thinking content")).toBeInTheDocument()

      // Click again to collapse
      fireEvent.click(screen.getByRole("button"))

      // Content should no longer be visible
      expect(screen.queryByText("Some thinking content")).not.toBeInTheDocument()
    })

    it("renders content with proper styling when expanded", () => {
      const { container } = render(<ThinkingBlock content="Some thinking content" />)

      // Expand
      fireEvent.click(screen.getByRole("button"))

      // Check that the content container has the expected styling classes
      const contentContainer = container.querySelector(".bg-muted\\/30")
      expect(contentContainer).toBeInTheDocument()
    })
  })

  describe("defaultExpanded prop", () => {
    it("starts expanded when defaultExpanded is true", () => {
      render(<ThinkingBlock content="Some thinking content" defaultExpanded={true} />)

      // Content should be visible immediately
      expect(screen.getByText("Some thinking content")).toBeInTheDocument()
    })

    it("starts collapsed when defaultExpanded is false", () => {
      render(<ThinkingBlock content="Some thinking content" defaultExpanded={false} />)

      // Content should not be visible
      expect(screen.queryByText("Some thinking content")).not.toBeInTheDocument()
    })

    it("starts collapsed when defaultExpanded is not provided", () => {
      render(<ThinkingBlock content="Some thinking content" />)

      // Content should not be visible (default is false)
      expect(screen.queryByText("Some thinking content")).not.toBeInTheDocument()
    })

    it("can still toggle after starting expanded", () => {
      render(<ThinkingBlock content="Some thinking content" defaultExpanded={true} />)

      // Initially expanded
      expect(screen.getByText("Some thinking content")).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(screen.getByRole("button"))

      // Content should now be hidden
      expect(screen.queryByText("Some thinking content")).not.toBeInTheDocument()

      // Click to expand again
      fireEvent.click(screen.getByRole("button"))

      // Content should be visible again
      expect(screen.getByText("Some thinking content")).toBeInTheDocument()
    })
  })

  describe("className prop", () => {
    it("applies custom className to the container", () => {
      const { container } = render(
        <ThinkingBlock content="Some thinking content" className="custom-class" />,
      )

      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("preserves default classes when custom className is applied", () => {
      const { container } = render(
        <ThinkingBlock content="Some thinking content" className="custom-class" />,
      )

      // Should have both the default padding classes and custom class
      expect(container.firstChild).toHaveClass("py-1.5")
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("works without className prop", () => {
      const { container } = render(<ThinkingBlock content="Some thinking content" />)

      // Should still have default classes
      expect(container.firstChild).toHaveClass("py-1.5")
      expect(container.firstChild).toHaveClass("pr-12")
      expect(container.firstChild).toHaveClass("pl-4")
    })
  })

  describe("content rendering", () => {
    it("renders markdown content when expanded", () => {
      render(<ThinkingBlock content="**bold text**" defaultExpanded={true} />)

      // The MarkdownContent component should render the content
      // We just check that the content is present (markdown rendering is handled by MarkdownContent)
      expect(screen.getByText(/bold text/)).toBeInTheDocument()
    })

    it("handles multiline content", () => {
      render(
        <ThinkingBlock
          content="First line of thinking.\nSecond line of thinking."
          defaultExpanded={true}
        />,
      )

      expect(screen.getByText(/First line of thinking/)).toBeInTheDocument()
      expect(screen.getByText(/Second line of thinking/)).toBeInTheDocument()
    })

    it("handles empty content", () => {
      render(<ThinkingBlock content="" defaultExpanded={true} />)

      // Should still render the header
      expect(screen.getByText("Thinking...")).toBeInTheDocument()
    })
  })
})
