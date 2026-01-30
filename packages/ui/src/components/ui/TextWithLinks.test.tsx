import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TextWithLinks } from "./TextWithLinks"
import { useAppStore } from "@/store"

describe("TextWithLinks", () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().reset()
    // Set a default issue prefix for tests
    useAppStore.getState().setIssuePrefix("rui")
    // Spy on pushState and dispatchEvent
    pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => {})
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  describe("session linking", () => {
    it("converts session path reference to clickable link (new format)", () => {
      render(<TextWithLinks>Session: /session/default-1706123456789</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session default-1706123456789" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("/session/default-1706123456789")
    })

    it("converts legacy #session= reference to clickable link", () => {
      render(<TextWithLinks>Session: #session=default-1706123456789</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session default-1706123456789" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#session=default-1706123456789")
    })

    it("converts legacy #eventlog= reference to clickable link", () => {
      render(<TextWithLinks>Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session abcdef12" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#eventlog=abcdef12")
    })

    it("navigates to session path when clicked (new format)", () => {
      render(<TextWithLinks>Click /session/default-123 here</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session default-123" })
      fireEvent.click(link)

      expect(pushStateSpy).toHaveBeenCalledWith(
        { sessionId: "default-123" },
        "",
        "/session/default-123",
      )
      expect(dispatchEventSpy).toHaveBeenCalled()
    })

    it("navigates to session path when clicking legacy #session= format", () => {
      render(<TextWithLinks>Click #session=default-123 here</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session default-123" })
      fireEvent.click(link)

      // Should use new /session/{id} path format when navigating
      expect(pushStateSpy).toHaveBeenCalledWith(
        { sessionId: "default-123" },
        "",
        "/session/default-123",
      )
      expect(dispatchEventSpy).toHaveBeenCalled()
    })

    it("navigates to session path when clicking legacy #eventlog= format", () => {
      render(<TextWithLinks>Click #eventlog=abcdef12 here</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session abcdef12" })
      fireEvent.click(link)

      // Should use new /session/{id} path format when navigating
      expect(pushStateSpy).toHaveBeenCalledWith({ sessionId: "abcdef12" }, "", "/session/abcdef12")
      expect(dispatchEventSpy).toHaveBeenCalled()
    })

    it("handles uppercase hex characters in legacy format", () => {
      render(<TextWithLinks>Ref: #eventlog=ABCDEF00</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session ABCDEF00" })
      expect(link).toBeInTheDocument()
    })
  })

  describe("mixed content", () => {
    it("handles both task IDs and session references in same text", () => {
      render(<TextWithLinks>Task rui-48s has session /session/default-123</TextWithLinks>)

      const taskLink = screen.getByRole("link", { name: "View task rui-48s" })
      const sessionLink = screen.getByRole("button", { name: "View session default-123" })

      expect(taskLink).toBeInTheDocument()
      expect(taskLink).toHaveAttribute("href", "/issue/rui-48s")
      expect(sessionLink).toBeInTheDocument()

      // Click session link
      fireEvent.click(sessionLink)
      expect(pushStateSpy).toHaveBeenCalledWith(
        { sessionId: "default-123" },
        "",
        "/session/default-123",
      )
    })

    it("handles task IDs with legacy eventlog references", () => {
      render(<TextWithLinks>Task rui-48s has event log #eventlog=abcdef12</TextWithLinks>)

      const taskLink = screen.getByRole("link", { name: "View task rui-48s" })
      const sessionLink = screen.getByRole("button", { name: "View session abcdef12" })

      expect(taskLink).toBeInTheDocument()
      expect(sessionLink).toBeInTheDocument()
    })

    it("preserves text between links", () => {
      const { container } = render(
        <TextWithLinks>Start rui-1 middle /session/session-1 end</TextWithLinks>,
      )

      // Task ID displayed without prefix
      expect(container.textContent).toBe("Start 1 middle /session/session-1 end")
    })

    it("handles multiple of each type", () => {
      render(
        <TextWithLinks>
          Tasks rui-1 and rui-2 with sessions /session/session-1 and /session/session-2
        </TextWithLinks>,
      )

      expect(screen.getByRole("link", { name: "View task rui-1" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-2" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View session session-1" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "View session session-2" })).toBeInTheDocument()
    })
  })

  describe("event propagation", () => {
    it("stops event propagation when clicking session link", () => {
      const parentClick = vi.fn()

      render(
        <div onClick={parentClick}>
          <TextWithLinks>Click #session=default-123 here</TextWithLinks>
        </div>,
      )

      const link = screen.getByRole("button", { name: "View session default-123" })
      fireEvent.click(link)

      expect(parentClick).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("does not linkify task IDs when no prefix is configured", () => {
      useAppStore.getState().setIssuePrefix(null)
      render(<TextWithLinks>Check rui-48s and /session/default-123</TextWithLinks>)

      // Task link should not exist (no prefix)
      expect(screen.queryByRole("link", { name: "View task rui-48s" })).not.toBeInTheDocument()

      // Session link should still work
      expect(screen.getByRole("button", { name: "View session default-123" })).toBeInTheDocument()
    })

    it("does not linkify invalid legacy eventlog references", () => {
      render(<TextWithLinks>#eventlog=abc is too short</TextWithLinks>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("handles closing comment format with new session path format", () => {
      render(<TextWithLinks>Closed. Session log: /session/default-123</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session default-123" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(pushStateSpy).toHaveBeenCalledWith(
        { sessionId: "default-123" },
        "",
        "/session/default-123",
      )
    })

    it("handles closing comment format with legacy #session= format", () => {
      render(<TextWithLinks>Closed. Session: #session=default-123</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session default-123" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(pushStateSpy).toHaveBeenCalledWith(
        { sessionId: "default-123" },
        "",
        "/session/default-123",
      )
    })

    it("handles closing comment format with legacy #eventlog= format", () => {
      render(<TextWithLinks>Closed. Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("button", { name: "View session abcdef12" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(pushStateSpy).toHaveBeenCalledWith({ sessionId: "abcdef12" }, "", "/session/abcdef12")
    })
  })
})
