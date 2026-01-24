import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskIdLink } from "./TaskIdLink"
import { containsTaskId } from "../../lib/containsTaskId"
import { useAppStore } from "@/store"

describe("TaskIdLink", () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().reset()
    // Set a default issue prefix for tests
    useAppStore.getState().setIssuePrefix("rui")
  })

  describe("basic rendering", () => {
    it("renders text without task IDs unchanged", () => {
      render(<TaskIdLink>Hello world</TaskIdLink>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders empty string correctly", () => {
      const { container } = render(<TaskIdLink>{""}</TaskIdLink>)
      expect(container.textContent).toBe("")
    })
  })

  describe("task ID linking", () => {
    it("converts task ID to clickable link with stripped prefix", () => {
      render(<TaskIdLink>Check out rui-48s for details</TaskIdLink>)

      const link = screen.getByRole("link", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("48s")
      expect(link).toHaveAttribute("href", "/issue/rui-48s")
    })

    it("handles multiple task IDs in same text", () => {
      render(<TaskIdLink>See rui-48s and also rui-26f for details</TaskIdLink>)

      const link1 = screen.getByRole("link", { name: "View task rui-48s" })
      const link2 = screen.getByRole("link", { name: "View task rui-26f" })

      expect(link1).toBeInTheDocument()
      expect(link1).toHaveAttribute("href", "/issue/rui-48s")
      expect(link2).toBeInTheDocument()
      expect(link2).toHaveAttribute("href", "/issue/rui-26f")
    })

    it("only matches task IDs with the configured prefix", () => {
      render(<TaskIdLink>Tasks: proj-abc123, foo-1, bar-xyz, rui-123</TaskIdLink>)

      // Only rui-123 should be a link since prefix is "rui"
      expect(screen.getByRole("link", { name: "View task rui-123" })).toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "View task proj-abc123" })).not.toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "View task foo-1" })).not.toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "View task bar-xyz" })).not.toBeInTheDocument()
    })

    it("matches task IDs when prefix is changed", () => {
      useAppStore.getState().setIssuePrefix("proj")
      render(<TaskIdLink>Tasks: proj-abc123, rui-123, foo-1</TaskIdLink>)

      // Only proj-abc123 should be a link since prefix is "proj"
      expect(screen.getByRole("link", { name: "View task proj-abc123" })).toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "View task rui-123" })).not.toBeInTheDocument()
      expect(screen.queryByRole("link", { name: "View task foo-1" })).not.toBeInTheDocument()
    })

    it("does not linkify anything when no prefix is configured", () => {
      useAppStore.getState().setIssuePrefix(null)
      render(<TaskIdLink>Check rui-48s and proj-123</TaskIdLink>)

      const links = screen.queryAllByRole("link")
      expect(links).toHaveLength(0)
    })

    it("handles task IDs with decimal suffixes", () => {
      render(<TaskIdLink>See rui-4vp.5 for the subtask</TaskIdLink>)

      const link = screen.getByRole("link", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("4vp.5")
      expect(link).toHaveAttribute("href", "/issue/rui-4vp.5")
    })

    it("handles multiple decimal suffix task IDs", () => {
      render(<TaskIdLink>Tasks rui-abc.1, rui-abc.2, and rui-xyz.10</TaskIdLink>)

      expect(screen.getByRole("link", { name: "View task rui-abc.1" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-abc.2" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-xyz.10" })).toBeInTheDocument()
    })

    it("handles mix of task IDs with and without decimal suffixes", () => {
      render(<TaskIdLink>Parent rui-abc and child rui-abc.1</TaskIdLink>)

      expect(screen.getByRole("link", { name: "View task rui-abc" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-abc.1" })).toBeInTheDocument()
    })

    it("handles deeply nested task IDs with multiple decimal suffixes", () => {
      render(<TaskIdLink>See rui-4vp.1.2 and rui-abc.1.2.3 for details</TaskIdLink>)

      const link1 = screen.getByRole("link", { name: "View task rui-4vp.1.2" })
      const link2 = screen.getByRole("link", { name: "View task rui-abc.1.2.3" })
      expect(link1).toBeInTheDocument()
      expect(link2).toBeInTheDocument()
      expect(link1).toHaveTextContent("4vp.1.2")
      expect(link2).toHaveTextContent("abc.1.2.3")
    })

    it("preserves text before, between, and after task IDs", () => {
      const { container } = render(<TaskIdLink>Start rui-1 middle rui-2 end</TaskIdLink>)

      // Task IDs are displayed without prefix
      expect(container.textContent).toBe("Start 1 middle 2 end")

      // Verify both task IDs are links
      expect(screen.getByRole("link", { name: "View task rui-1" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-2" })).toBeInTheDocument()
    })

    it("does not linkify uppercase task IDs", () => {
      render(<TaskIdLink>RUI-48S is not a valid task ID</TaskIdLink>)

      const links = screen.queryAllByRole("link")
      expect(links).toHaveLength(0)
    })

    it("does not linkify IDs with only prefix", () => {
      render(<TaskIdLink>rui- is incomplete</TaskIdLink>)

      const links = screen.queryAllByRole("link")
      expect(links).toHaveLength(0)
    })

    it("does not linkify arbitrary hyphenated words", () => {
      render(
        <TaskIdLink>Words like self-contained or high-quality should not be linkified</TaskIdLink>,
      )

      const links = screen.queryAllByRole("link")
      expect(links).toHaveLength(0)
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

  it("returns true for deeply nested task IDs with multiple decimal suffixes", () => {
    expect(containsTaskId("Check rui-48s.1.2", "rui")).toBe(true)
    expect(containsTaskId("proj-abc.1.2.3", "proj")).toBe(true)
    expect(containsTaskId("rui-xyz.1.2.3.4.5", "rui")).toBe(true)
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
    expect(containsTaskId("self-contained", "rui")).toBe(false)
    expect(containsTaskId("high-quality work", "rui")).toBe(false)
    expect(containsTaskId("This is a well-known fact", "rui")).toBe(false)
  })
})
