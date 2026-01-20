import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MarkdownContent } from "./MarkdownContent"
import { TaskDialogProvider } from "@/contexts"
import { useAppStore } from "@/store"

// Mock useTheme hook
vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}))

// Helper to render with context
function renderWithContext(ui: React.ReactNode, openTaskById = vi.fn()) {
  return render(<TaskDialogProvider openTaskById={openTaskById}>{ui}</TaskDialogProvider>)
}

describe("MarkdownContent", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    useAppStore.getState().setIssuePrefix("rui")
  })

  describe("basic markdown rendering", () => {
    it("renders plain text", () => {
      renderWithContext(<MarkdownContent>Hello world</MarkdownContent>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders bold text", () => {
      renderWithContext(<MarkdownContent>This is **bold** text</MarkdownContent>)
      const strong = screen.getByText("bold")
      expect(strong.tagName).toBe("STRONG")
    })

    it("renders italic text", () => {
      renderWithContext(<MarkdownContent>This is *italic* text</MarkdownContent>)
      const em = screen.getByText("italic")
      expect(em.tagName).toBe("EM")
    })

    it("renders inline code", () => {
      renderWithContext(<MarkdownContent>Use `console.log()`</MarkdownContent>)
      const code = screen.getByText("console.log()")
      expect(code.tagName).toBe("CODE")
    })

    it("renders links", () => {
      renderWithContext(<MarkdownContent>Visit [Google](https://google.com)</MarkdownContent>)
      const link = screen.getByRole("link", { name: "Google" })
      expect(link).toHaveAttribute("href", "https://google.com")
    })

    it("renders bullet lists", () => {
      renderWithContext(<MarkdownContent>{`- Item 1\n- Item 2\n- Item 3`}</MarkdownContent>)
      expect(screen.getByText("Item 1")).toBeInTheDocument()
      expect(screen.getByText("Item 2")).toBeInTheDocument()
      expect(screen.getByText("Item 3")).toBeInTheDocument()
    })

    it("renders numbered lists", () => {
      renderWithContext(<MarkdownContent>{`1. First\n2. Second\n3. Third`}</MarkdownContent>)
      expect(screen.getByText("First")).toBeInTheDocument()
      expect(screen.getByText("Second")).toBeInTheDocument()
      expect(screen.getByText("Third")).toBeInTheDocument()
    })
  })

  describe("GFM (GitHub Flavored Markdown)", () => {
    it("renders strikethrough text", () => {
      renderWithContext(<MarkdownContent>This is ~~deleted~~ text</MarkdownContent>)
      const del = screen.getByText("deleted")
      expect(del.tagName).toBe("DEL")
    })

    it("renders task lists", () => {
      renderWithContext(<MarkdownContent>{`- [x] Done\n- [ ] Not done`}</MarkdownContent>)
      const checkboxes = screen.getAllByRole("checkbox")
      expect(checkboxes).toHaveLength(2)
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
    })

    it("renders tables", () => {
      const markdown = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`
      renderWithContext(<MarkdownContent>{markdown}</MarkdownContent>)
      expect(screen.getByText("Header 1")).toBeInTheDocument()
      expect(screen.getByText("Cell 1")).toBeInTheDocument()
    })
  })

  describe("task ID linking", () => {
    it("converts task IDs to clickable links", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <MarkdownContent>Check out rui-48s for details</MarkdownContent>,
        openTaskById,
      )

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
    })

    it("calls openTaskById when task link is clicked", () => {
      const openTaskById = vi.fn()
      renderWithContext(<MarkdownContent>See rui-48s</MarkdownContent>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      fireEvent.click(link)

      expect(openTaskById).toHaveBeenCalledWith("rui-48s")
    })

    it("handles task IDs in bold text", () => {
      const openTaskById = vi.fn()
      renderWithContext(<MarkdownContent>**Important: rui-48s**</MarkdownContent>, openTaskById)

      expect(screen.getByRole("button", { name: "View task rui-48s" })).toBeInTheDocument()
    })

    it("handles task IDs in list items", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <MarkdownContent>{`- Task rui-48s\n- Task rui-123`}</MarkdownContent>,
        openTaskById,
      )

      expect(screen.getByRole("button", { name: "View task rui-48s" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View task rui-123" })).toBeInTheDocument()
    })

    it("handles task IDs with decimal suffixes", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <MarkdownContent>See rui-4vp.5 for the subtask</MarkdownContent>,
        openTaskById,
      )

      const link = screen.getByRole("button", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(openTaskById).toHaveBeenCalledWith("rui-4vp.5")
    })
  })

  describe("code blocks", () => {
    it("renders fenced code blocks with syntax highlighting when withCodeBlocks is true", () => {
      const markdown = "```javascript\nconst x = 1;\n```"
      renderWithContext(<MarkdownContent withCodeBlocks={true}>{markdown}</MarkdownContent>)

      // CodeBlock component should render the code
      expect(screen.getByText(/const/)).toBeInTheDocument()
    })

    it("renders fenced code blocks as plain code when withCodeBlocks is false", () => {
      const markdown = "```javascript\nconst x = 1;\n```"
      renderWithContext(<MarkdownContent withCodeBlocks={false}>{markdown}</MarkdownContent>)

      expect(screen.getByText("const x = 1;")).toBeInTheDocument()
    })
  })

  describe("styling", () => {
    it("applies prose classes for typography", () => {
      const { container } = renderWithContext(<MarkdownContent>Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose", "dark:prose-invert")
    })

    it("applies custom className", () => {
      const { container } = renderWithContext(
        <MarkdownContent className="custom-class">Test</MarkdownContent>,
      )
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("custom-class")
    })

    it("applies prose-sm for small size", () => {
      const { container } = renderWithContext(<MarkdownContent size="sm">Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose-sm")
    })

    it("applies prose-base for base size", () => {
      const { container } = renderWithContext(<MarkdownContent size="base">Test</MarkdownContent>)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("prose-base")
    })
  })

  describe("edge cases", () => {
    it("handles empty string", () => {
      const { container } = renderWithContext(<MarkdownContent>{""}</MarkdownContent>)
      // Should render without errors
      expect(container.querySelector(".prose")).toBeInTheDocument()
    })

    it("handles string with only whitespace", () => {
      renderWithContext(<MarkdownContent>{"   "}</MarkdownContent>)
      // Should render without errors
    })

    it("handles string with HTML entities", () => {
      renderWithContext(<MarkdownContent>{"&amp; &lt; &gt;"}</MarkdownContent>)
      // react-markdown handles HTML entities
      expect(screen.getByText("& < >")).toBeInTheDocument()
    })

    it("escapes HTML tags in markdown", () => {
      renderWithContext(<MarkdownContent>{"<script>alert('xss')</script>"}</MarkdownContent>)
      // Script tags should be rendered as text, not executed
      expect(screen.queryByRole("script")).not.toBeInTheDocument()
    })
  })
})
