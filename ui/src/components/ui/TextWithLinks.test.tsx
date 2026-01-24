import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TextWithLinks } from "./TextWithLinks"
import { TaskDialogProvider } from "@/contexts"
import { useAppStore } from "@/store"

// Helper to render with context
function renderWithContext(ui: React.ReactNode, openTaskById = vi.fn()) {
  return render(<TaskDialogProvider openTaskById={openTaskById}>{ui}</TaskDialogProvider>)
}

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
      renderWithContext(<TextWithLinks>Hello world</TextWithLinks>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders empty string correctly", () => {
      const { container } = renderWithContext(<TextWithLinks>{""}</TextWithLinks>)
      expect(container.textContent).toBe("")
    })
  })

  describe("task ID linking", () => {
    it("converts task ID to clickable link with stripped prefix", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TextWithLinks>Check out rui-48s for details</TextWithLinks>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("48s")
    })

    it("calls openTaskById when task link is clicked", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TextWithLinks>Check rui-48s</TextWithLinks>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      fireEvent.click(link)

      expect(openTaskById).toHaveBeenCalledWith("rui-48s")
    })

    it("handles task IDs with decimal suffixes", () => {
      const openTaskById = vi.fn()
      renderWithContext(<TextWithLinks>See rui-4vp.5 for the subtask</TextWithLinks>, openTaskById)

      const link = screen.getByRole("button", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("4vp.5")
    })
  })

  describe("event log linking", () => {
    it("converts eventlog reference to clickable link", () => {
      renderWithContext(<TextWithLinks>Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#eventlog=abcdef12")
    })

    it("navigates to eventlog hash when clicked", () => {
      renderWithContext(<TextWithLinks>Click #eventlog=abcdef12 here</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      fireEvent.click(link)

      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })

    it("handles uppercase hex characters", () => {
      renderWithContext(<TextWithLinks>Ref: #eventlog=ABCDEF00</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View event log ABCDEF00" })
      expect(link).toBeInTheDocument()
    })
  })

  describe("mixed content", () => {
    it("handles both task IDs and eventlog references in same text", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <TextWithLinks>Task rui-48s has event log #eventlog=abcdef12</TextWithLinks>,
        openTaskById,
      )

      const taskLink = screen.getByRole("button", { name: "View task rui-48s" })
      const eventLogLink = screen.getByRole("button", { name: "View event log abcdef12" })

      expect(taskLink).toBeInTheDocument()
      expect(eventLogLink).toBeInTheDocument()

      // Click task link
      fireEvent.click(taskLink)
      expect(openTaskById).toHaveBeenCalledWith("rui-48s")

      // Click event log link
      fireEvent.click(eventLogLink)
      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })

    it("preserves text between links", () => {
      const { container } = renderWithContext(
        <TextWithLinks>Start rui-1 middle #eventlog=11111111 end</TextWithLinks>,
      )

      // Task ID displayed without prefix
      expect(container.textContent).toBe("Start 1 middle #eventlog=11111111 end")
    })

    it("handles multiple of each type", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <TextWithLinks>
          Tasks rui-1 and rui-2 with logs #eventlog=11111111 and #eventlog=22222222
        </TextWithLinks>,
        openTaskById,
      )

      expect(screen.getByRole("button", { name: "View task rui-1" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View task rui-2" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View event log 11111111" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View event log 22222222" })).toBeInTheDocument()
    })
  })

  describe("event propagation", () => {
    it("stops event propagation when clicking task link", () => {
      const openTaskById = vi.fn()
      const parentClick = vi.fn()

      render(
        <TaskDialogProvider openTaskById={openTaskById}>
          <div onClick={parentClick}>
            <TextWithLinks>Click rui-48s here</TextWithLinks>
          </div>
        </TaskDialogProvider>,
      )

      const link = screen.getByRole("button", { name: "View task rui-48s" })
      fireEvent.click(link)

      expect(openTaskById).toHaveBeenCalled()
      expect(parentClick).not.toHaveBeenCalled()
    })

    it("stops event propagation when clicking eventlog link", () => {
      const parentClick = vi.fn()

      renderWithContext(
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
      renderWithContext(<TextWithLinks>Check rui-48s and #eventlog=abcdef12</TextWithLinks>)

      // Task link should not exist (no prefix)
      expect(screen.queryByRole("button", { name: "View task rui-48s" })).not.toBeInTheDocument()

      // Event log link should still work
      expect(screen.getByRole("button", { name: "View event log abcdef12" })).toBeInTheDocument()
    })

    it("does not linkify invalid eventlog references", () => {
      renderWithContext(<TextWithLinks>#eventlog=abc is too short</TextWithLinks>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("handles closing comment format", () => {
      const openTaskById = vi.fn()
      renderWithContext(
        <TextWithLinks>Closed. Event log: #eventlog=abcdef12</TextWithLinks>,
        openTaskById,
      )

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })
  })
})
