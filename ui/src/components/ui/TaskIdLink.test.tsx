import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskIdLink, containsTaskId } from "./TaskIdLink"
import { TaskDialogProvider } from "@/contexts"
import { useAppStore } from "@/store"

// Helper to render with context
function renderWithContext(ui: React.ReactNode, openTaskById = vi.fn()) {
  return render(<TaskDialogProvider openTaskById={openTaskById}>{ui}</TaskDialogProvider>)
}

describe("TaskIdLink", () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().reset()
    // Set a default issue prefix for tests
    useAppStore.getState().setIssuePrefix("rui")
  })

  describe("without context", () => {
    it("renders text without changes when no context is provided", () => {
      render(<TaskIdLink>Check out rui-48s for details</TaskIdLink>)
      expect(screen.getByText("Check out rui-48s for details")).toBeInTheDocument()
    })

    it("renders empty string correctly", () => {
      const { container } = render(<TaskIdLink>{""}</TaskIdLink>)
      expect(container.textContent).toBe("")
    })
  })

  describe("with context", () => {
    it("renders text without task IDs unchanged", () => {
      renderWithContext(<TaskIdLink>Hello world</TaskIdLink>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("converts task ID to clickable link with stripped prefix", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TaskIdLink>Check out rui-48s for details</TaskIdLink>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
      // Display shows stripped prefix
      expect(link).toHaveTextContent("48s")
    })

    it("calls openTaskById when task link is clicked", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TaskIdLink>Check rui-48s</TaskIdLink>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      fireEvent.click(link)

      expect(openTaskById).toHaveBeenCalledWith("rui-48s")
      expect(openTaskById).toHaveBeenCalledTimes(1)
    })

    it("handles multiple task IDs in same text", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <TaskIdLink>See rui-48s and also rui-26f for details</TaskIdLink>,
        openTaskById,
      )

      const link1 = screen.getByRole("button", { name: "View task rui-48s" })
      const link2 = screen.getByRole("button", { name: "View task rui-26f" })

      expect(link1).toBeInTheDocument()
      expect(link2).toBeInTheDocument()

      fireEvent.click(link1)
      expect(openTaskById).toHaveBeenCalledWith("rui-48s")

      fireEvent.click(link2)
      expect(openTaskById).toHaveBeenCalledWith("rui-26f")
    })

    it("only matches task IDs with the configured prefix", () => {
      const openTaskById = vi.fn()
      // With prefix "rui", only rui-xxx should match
      renderWithContext(
        <TaskIdLink>Tasks: proj-abc123, foo-1, bar-xyz, rui-123</TaskIdLink>,
        openTaskById,
      )

      // Only rui-123 should be a link since prefix is "rui"
      expect(screen.getByRole("button", { name: "View task rui-123" })).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "View task proj-abc123" }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "View task foo-1" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "View task bar-xyz" })).not.toBeInTheDocument()
    })

    it("matches task IDs when prefix is changed", () => {
      const openTaskById = vi.fn()
      useAppStore.getState().setIssuePrefix("proj")
      renderWithContext(<TaskIdLink>Tasks: proj-abc123, rui-123, foo-1</TaskIdLink>, openTaskById)

      // Only proj-abc123 should be a link since prefix is "proj"
      expect(screen.getByRole("button", { name: "View task proj-abc123" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "View task rui-123" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "View task foo-1" })).not.toBeInTheDocument()
    })

    it("does not linkify anything when no prefix is configured", () => {
      useAppStore.getState().setIssuePrefix(null)
      renderWithContext(<TaskIdLink>Check rui-48s and proj-123</TaskIdLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("handles task IDs with decimal suffixes", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TaskIdLink>See rui-4vp.5 for the subtask</TaskIdLink>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()
      // Display shows stripped prefix
      expect(link).toHaveTextContent("4vp.5")

      fireEvent.click(link)
      expect(openTaskById).toHaveBeenCalledWith("rui-4vp.5")
    })

    it("handles multiple decimal suffix task IDs", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <TaskIdLink>Tasks rui-abc.1, rui-abc.2, and rui-xyz.10</TaskIdLink>,
        openTaskById,
      )

      expect(screen.getByRole("button", { name: "View task rui-abc.1" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View task rui-abc.2" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View task rui-xyz.10" })).toBeInTheDocument()
    })

    it("handles mix of task IDs with and without decimal suffixes", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TaskIdLink>Parent rui-abc and child rui-abc.1</TaskIdLink>, openTaskById)

      expect(screen.getByRole("button", { name: "View task rui-abc" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View task rui-abc.1" })).toBeInTheDocument()
    })

    it("preserves text before, between, and after task IDs", () => {
      const { container } = renderWithContext(<TaskIdLink>Start rui-1 middle rui-2 end</TaskIdLink>)

      // Check the full text content - task IDs are displayed without prefix
      expect(container.textContent).toBe("Start 1 middle 2 end")

      // Verify both task IDs are clickable (aria-label uses full ID)
      expect(screen.getByRole("button", { name: "View task rui-1" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View task rui-2" })).toBeInTheDocument()
    })

    it("does not linkify uppercase task IDs", () => {
      renderWithContext(<TaskIdLink>RUI-48S is not a valid task ID</TaskIdLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify IDs with only prefix", () => {
      renderWithContext(<TaskIdLink>rui- is incomplete</TaskIdLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify arbitrary hyphenated words", () => {
      renderWithContext(
        <TaskIdLink>Words like self-contained or high-quality should not be linkified</TaskIdLink>,
      )

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("stops event propagation when clicking task link", () => {
      const openTaskById = vi.fn()
      const parentClick = vi.fn()

      render(
        <TaskDialogProvider openTaskById={openTaskById}>
          <div onClick={parentClick}>
            <TaskIdLink>Click rui-48s here</TaskIdLink>
          </div>
        </TaskDialogProvider>,
      )

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      fireEvent.click(link)

      expect(openTaskById).toHaveBeenCalled()
      expect(parentClick).not.toHaveBeenCalled()
    })
  })
})

describe("containsTaskId", () => {
  it("returns true for text containing a task ID with matching prefix", () => {
    expect(containsTaskId("Check rui-48s", "rui")).toBe(true)
    expect(containsTaskId("proj-abc123", "proj")).toBe(true)
  })

  it("returns false for text containing task IDs with non-matching prefix", () => {
    expect(containsTaskId("Check rui-48s", "proj")).toBe(false)
    expect(containsTaskId("proj-abc123", "rui")).toBe(false)
  })

  it("returns true for task IDs with decimal suffixes", () => {
    expect(containsTaskId("Check rui-48s.5", "rui")).toBe(true)
    expect(containsTaskId("proj-abc.1", "proj")).toBe(true)
    expect(containsTaskId("rui-xyz.10", "rui")).toBe(true)
  })

  it("returns false for text without task IDs", () => {
    expect(containsTaskId("Hello world", "rui")).toBe(false)
    expect(containsTaskId("", "rui")).toBe(false)
    expect(containsTaskId("RUI-48S", "rui")).toBe(false)
    expect(containsTaskId("rui-", "rui")).toBe(false)
  })

  it("returns false when prefix is null", () => {
    expect(containsTaskId("Check rui-48s", null)).toBe(false)
    expect(containsTaskId("proj-abc123", null)).toBe(false)
  })

  it("does not match hyphenated words when prefix doesn't match", () => {
    // With prefix "rui", words like "self-contained" or "high-quality" won't match
    expect(containsTaskId("self-contained", "rui")).toBe(false)
    expect(containsTaskId("high-quality work", "rui")).toBe(false)
    expect(containsTaskId("This is a well-known fact", "rui")).toBe(false)
  })
})
