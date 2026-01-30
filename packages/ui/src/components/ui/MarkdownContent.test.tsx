import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MarkdownContent } from "@herbcaudill/agent-view"
import { AgentViewTestWrapper } from "@/test/agentViewTestWrapper"
import type { AgentViewContextValue } from "@herbcaudill/agent-view"

// Mock useTheme hook
vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}))

/** Render wrapped in AgentViewProvider with default test context. */
function renderWithContext(ui: React.ReactElement, overrides?: Partial<AgentViewContextValue>) {
  return render(<AgentViewTestWrapper value={overrides}>{ui}</AgentViewTestWrapper>)
}

describe("MarkdownContent", () => {
  describe("basic markdown rendering", () => {
    it("renders plain text", () => {
      render(<MarkdownContent>Hello world</MarkdownContent>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders bold text", () => {
      render(<MarkdownContent>This is **bold** text</MarkdownContent>)
      const strong = screen.getByText("bold")
      expect(strong.tagName).toBe("STRONG")
    })

    it("renders italic text", () => {
      render(<MarkdownContent>This is *italic* text</MarkdownContent>)
      const em = screen.getByText("italic")
      expect(em.tagName).toBe("EM")
    })

    it("renders inline code", () => {
      render(<MarkdownContent>Use `console.log()`</MarkdownContent>)
      const code = screen.getByText("console.log()")
      expect(code.tagName).toBe("CODE")
    })

    it("renders links", () => {
      render(<MarkdownContent>Visit [Google](https://google.com)</MarkdownContent>)
      const link = screen.getByRole("link", { name: "Google" })
      expect(link).toHaveAttribute("href", "https://google.com")
    })

    it("renders bullet lists", () => {
      render(<MarkdownContent>{`- Item 1\n- Item 2\n- Item 3`}</MarkdownContent>)
      expect(screen.getByText("Item 1")).toBeInTheDocument()
      expect(screen.getByText("Item 2")).toBeInTheDocument()
      expect(screen.getByText("Item 3")).toBeInTheDocument()
    })

    it("renders numbered lists", () => {
      render(<MarkdownContent>{`1. First\n2. Second\n3. Third`}</MarkdownContent>)
      expect(screen.getByText("First")).toBeInTheDocument()
      expect(screen.getByText("Second")).toBeInTheDocument()
      expect(screen.getByText("Third")).toBeInTheDocument()
    })
  })

  describe("GFM (GitHub Flavored Markdown)", () => {
    it("renders strikethrough text", () => {
      render(<MarkdownContent>This is ~~deleted~~ text</MarkdownContent>)
      const del = screen.getByText("deleted")
      expect(del.tagName).toBe("DEL")
    })

    it("renders task lists", () => {
      render(<MarkdownContent>{`- [x] Done\n- [ ] Not done`}</MarkdownContent>)
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes).toHaveLength(2)
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
    })

    it("renders tables", () => {
      const markdown = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`
      render(<MarkdownContent>{markdown}</MarkdownContent>)
      expect(screen.getByText("Header 1")).toBeInTheDocument()
      expect(screen.getByText("Cell 1")).toBeInTheDocument()
    })
  })

  describe("task ID linking", () => {
    it("converts task IDs to clickable links", () => {
      renderWithContext(<MarkdownContent>Check out rui-48s for details</MarkdownContent>)

      const link = screen.getByRole("link", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/issue/rui-48s")
    })

    it("handles task IDs in bold text", () => {
      renderWithContext(<MarkdownContent>**Important: rui-48s**</MarkdownContent>)

      expect(screen.getByRole("link", { name: "View task rui-48s" })).toBeInTheDocument()
    })

    it("handles task IDs in list items", () => {
      renderWithContext(<MarkdownContent>{`- Task rui-48s\n- Task rui-123`}</MarkdownContent>)

      expect(screen.getByRole("link", { name: "View task rui-48s" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-123" })).toBeInTheDocument()
    })

    it("handles task IDs with decimal suffixes", () => {
      renderWithContext(<MarkdownContent>See rui-4vp.5 for the subtask</MarkdownContent>)

      const link = screen.getByRole("link", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/issue/rui-4vp.5")
    })
  })

  describe("code blocks", () => {
    it("renders fenced code blocks with syntax highlighting when withCodeBlocks is true", () => {
      const markdown = "```javascript\nconst x = 1;\n```"
      render(<MarkdownContent withCodeBlocks={true}>{markdown}</MarkdownContent>)

      // CodeBlock component should render the code
      expect(screen.getByText(/const/)).toBeInTheDocument()
    })

    it("renders fenced code blocks as plain code when withCodeBlocks is false", () => {
      const markdown = "```javascript\nconst x = 1;\n```"
      render(<MarkdownContent withCodeBlocks={false}>{markdown}</MarkdownContent>)

      expect(screen.getByText("const x = 1;")).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies prose classes for typography", () => {
      const { container } = render(<MarkdownContent>Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose", "dark:prose-invert")
    })

    it("applies custom className", () => {
      const { container } = render(<MarkdownContent className="custom-class">Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("custom-class")
    })

    it("applies prose-sm for small size", () => {
      const { container } = render(<MarkdownContent size="sm">Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose-sm")
    })

    it("applies prose-base for base size", () => {
      const { container } = render(<MarkdownContent size="base">Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose-base")
    })

    it("applies non-italic styling to blockquotes", () => {
      const { container } = render(<MarkdownContent>Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose-blockquote:not-italic")
    })
  })

  describe("edge cases", () => {
    it("handles empty string", () => {
      const { container } = render(<MarkdownContent>{""}</MarkdownContent>)
      // Should render without errors
      expect(container.querySelector(".prose")).toBeInTheDocument()
    })

    it("handles string with only whitespace", () => {
      render(<MarkdownContent>{"   "}</MarkdownContent>)
      // Should render without errors
    })

    it("handles string with HTML entities", () => {
      render(<MarkdownContent>{"&amp; &lt; &gt;"}</MarkdownContent>)
      // react-markdown handles HTML entities
      expect(screen.getByText("& < >")).toBeInTheDocument()
    })

    it("escapes HTML tags in markdown", () => {
      render(<MarkdownContent>{"<script>alert('xss')</script>"}</MarkdownContent>)
      // Script tags should be rendered as text, not executed
      expect(screen.queryByRole("script")).not.toBeInTheDocument()
    })
  })
})
