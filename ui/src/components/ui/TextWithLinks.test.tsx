import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TextWithLinks } from "./TextWithLinks"
import { useAppStore } from "@/store"

describe("TextWithLinks", () => {
  const originalHash = window.location.hash

  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().reset()
    // Set a default issue prefix for tests
    useAppStore.getState().setIssuePrefix("rui")
    window.location.hash = ""
  })

  afterEach(() => {
    window.location.hash = originalHash
  })

  describe("basic rendering", () => {
    it("renders text without any links unchanged", () => {
      render(<TextWithLinks>Hello world</TextWithLinks>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders empty string correctly", () => {
      const { container } = render(<TextWithLinks>{""}</TextWithLinks>)
      expect(container.textContent).toBe("")
    })
  })

  describe("task ID linking", () => {
    it("converts task ID to clickable link with stripped prefix", () => {
      render(<TextWithLinks>Check out rui-48s for details</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("48s")
      expect(link).toHaveAttribute("href", "/issue/rui-48s")
    })

    it("handles task IDs with decimal suffixes", () => {
      render(<TextWithLinks>See rui-4vp.5 for the subtask</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("4vp.5")
      expect(link).toHaveAttribute("href", "/issue/rui-4vp.5")
    })
  })

  describe("event log linking", () => {
    it("converts eventlog reference to clickable link", () => {
      render(<TextWithLinks>Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#eventlog=abcdef12")
    })

    it("navigates to eventlog hash when clicked", () => {
      render(<TextWithLinks>Click #eventlog=abcdef12 here</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      fireEvent.click(link)

      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })

    it("handles uppercase hex characters", () => {
      render(<TextWithLinks>Ref: #eventlog=ABCDEF00</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log ABCDEF00" })
      expect(link).toBeInTheDocument()
    })
  })

  describe("mixed content", () => {
    it("handles both task IDs and eventlog references in same text", () => {
      render(<TextWithLinks>Task rui-48s has event log #eventlog=abcdef12</TextWithLinks>)

      const taskLink = screen.getByRole("link", { name: "View task rui-48s" })
      const eventLogLink = screen.getByRole("button", { name: "View event log abcdef12" })

      expect(taskLink).toBeInTheDocument()
      expect(taskLink).toHaveAttribute("href", "/issue/rui-48s")
      expect(eventLogLink).toBeInTheDocument()

      // Click event log link
      fireEvent.click(eventLogLink)
      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })

    it("preserves text between links", () => {
      const { container } = render(
        <TextWithLinks>Start rui-1 middle #eventlog=11111111 end</TextWithLinks>,
      )

      // Task ID displayed without prefix
      expect(container.textContent).toBe("Start 1 middle #eventlog=11111111 end")
    })

    it("handles multiple of each type", () => {
      render(
        <TextWithLinks>
          Tasks rui-1 and rui-2 with logs #eventlog=11111111 and #eventlog=22222222
        </TextWithLinks>,
      )

      expect(screen.getByRole("link", { name: "View task rui-1" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-2" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View event log 11111111" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View event log 22222222" })).toBeInTheDocument()
    })
  })

  describe("event propagation", () => {
    it("stops event propagation when clicking eventlog link", () => {
      const parentClick = vi.fn()

      render(
        <div onClick={parentClick}>
          <TextWithLinks>Click #eventlog=abcdef12 here</TextWithLinks>
        </div>,
      )

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      fireEvent.click(link)

      expect(parentClick).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("does not linkify task IDs when no prefix is configured", () => {
      useAppStore.getState().setIssuePrefix(null)
      render(<TextWithLinks>Check rui-48s and #eventlog=abcdef12</TextWithLinks>)

      // Task link should not exist (no prefix)
      expect(screen.queryByRole("link", { name: "View task rui-48s" })).not.toBeInTheDocument()

      // Event log link should still work
      expect(screen.getByRole("button", { name: "View event log abcdef12" })).toBeInTheDocument()
    })

    it("does not linkify invalid eventlog references", () => {
      render(<TextWithLinks>#eventlog=abc is too short</TextWithLinks>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("handles closing comment format", () => {
      render(<TextWithLinks>Closed. Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })
  })
})
