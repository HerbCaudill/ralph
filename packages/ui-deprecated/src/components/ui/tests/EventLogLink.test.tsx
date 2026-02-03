import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EventLogLink, containsEventLogRef } from ".././EventLogLink"

describe("EventLogLink", () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => {})
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders text without session references unchanged", () => {
      render(<EventLogLink>Hello world</EventLogLink>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders empty string correctly", () => {
      const { container } = render(<EventLogLink>{""}</EventLogLink>)
      expect(container.textContent).toBe("")
    })

    it("converts session path reference to clickable link (new format)", () => {
      render(<EventLogLink>Session: /session/default-1706123456789</EventLogLink>)

      const link = screen.getByRole("button", { name: "View session default-1706123456789" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("/session/default-1706123456789")
    })

    it("converts legacy #session= reference to clickable link (backward compatibility)", () => {
      render(<EventLogLink>Session: #session=default-1706123456789</EventLogLink>)

      const link = screen.getByRole("button", { name: "View session default-1706123456789" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#session=default-1706123456789")
    })

    it("converts legacy eventlog reference to clickable link (backward compatibility)", () => {
      render(<EventLogLink>Event log: #eventlog=abcdef12</EventLogLink>)

      const link = screen.getByRole("button", { name: "View session abcdef12" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#eventlog=abcdef12")
    })

    it("handles multiple session references in same text", () => {
      render(
        <EventLogLink>See #session=session-1 and also #session=session-2 for details</EventLogLink>,
      )

      const link1 = screen.getByRole("button", { name: "View session session-1" })
      const link2 = screen.getByRole("button", { name: "View session session-2" })

      expect(link1).toBeInTheDocument()
      expect(link2).toBeInTheDocument()
    })

    it("handles mixed new and legacy formats", () => {
      render(<EventLogLink>New: #session=default-123 and legacy: #eventlog=abcdef12</EventLogLink>)

      const link1 = screen.getByRole("button", { name: "View session default-123" })
      const link2 = screen.getByRole("button", { name: "View session abcdef12" })

      expect(link1).toBeInTheDocument()
      expect(link2).toBeInTheDocument()
    })

    it("preserves text before, between, and after session references", () => {
      const { container } = render(
        <EventLogLink>Start #session=session-1 middle #session=session-2 end</EventLogLink>,
      )

      expect(container.textContent).toBe("Start #session=session-1 middle #session=session-2 end")
    })

    it("handles uppercase hex characters in legacy format", () => {
      render(<EventLogLink>Ref: #eventlog=ABCDEF00</EventLogLink>)

      const link = screen.getByRole("button", { name: "View session ABCDEF00" })
      expect(link).toBeInTheDocument()
    })

    it("handles mixed case in session IDs", () => {
      render(<EventLogLink>Ref: #session=MySession2025</EventLogLink>)

      const link = screen.getByRole("button", { name: "View session MySession2025" })
      expect(link).toBeInTheDocument()
    })
  })

  describe("invalid patterns", () => {
    it("does not linkify legacy IDs with too few characters", () => {
      render(<EventLogLink>#eventlog=abc is too short</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify legacy IDs with too many characters", () => {
      render(<EventLogLink>#eventlog=abcdef123 is too long</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify legacy IDs with non-hex characters", () => {
      render(<EventLogLink>#eventlog=ghijklmn is not hex</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify empty session reference", () => {
      render(<EventLogLink>#session= is empty</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify just hash", () => {
      render(<EventLogLink>Just a #</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })
  })

  describe("click handling", () => {
    it("navigates to session path when clicking new format", () => {
      render(<EventLogLink>Click /session/default-123 here</EventLogLink>)

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
      render(<EventLogLink>Click #session=default-123 here</EventLogLink>)

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
      render(<EventLogLink>Click #eventlog=abcdef12 here</EventLogLink>)

      const link = screen.getByRole("button", { name: "View session abcdef12" })
      fireEvent.click(link)

      // Should use new /session/{id} path format when navigating
      expect(pushStateSpy).toHaveBeenCalledWith({ sessionId: "abcdef12" }, "", "/session/abcdef12")
      expect(dispatchEventSpy).toHaveBeenCalled()
    })

    it("stops event propagation when clicking session link", () => {
      const parentClick = vi.fn()

      render(
        <div onClick={parentClick}>
          <EventLogLink>Click /session/default-123 here</EventLogLink>
        </div>,
      )

      const link = screen.getByRole("button", { name: "View session default-123" })
      fireEvent.click(link)

      expect(parentClick).not.toHaveBeenCalled()
    })
  })
})

describe("containsEventLogRef", () => {
  it("returns true for text containing a valid session path reference (new format)", () => {
    expect(containsEventLogRef("Session: /session/default-123")).toBe(true)
    expect(containsEventLogRef("/session/abc123")).toBe(true)
    expect(containsEventLogRef("See /session/MySession-2025 for details")).toBe(true)
  })

  it("returns true for text containing a valid legacy #session= reference", () => {
    expect(containsEventLogRef("Session: #session=default-123")).toBe(true)
    expect(containsEventLogRef("#session=abc123")).toBe(true)
    expect(containsEventLogRef("See #session=MySession-2025 for details")).toBe(true)
  })

  it("returns true for text containing a valid legacy #eventlog= reference", () => {
    expect(containsEventLogRef("Event log: #eventlog=abcdef12")).toBe(true)
    expect(containsEventLogRef("#eventlog=12345678")).toBe(true)
    expect(containsEventLogRef("See #eventlog=ABCDEF00 for details")).toBe(true)
  })

  it("returns false for text without session references", () => {
    expect(containsEventLogRef("Hello world")).toBe(false)
    expect(containsEventLogRef("")).toBe(false)
    expect(containsEventLogRef("#eventlog=abc")).toBe(false) // too short
    expect(containsEventLogRef("#eventlog=abcdef123")).toBe(false) // too long
    expect(containsEventLogRef("#eventlog=ghijklmn")).toBe(false) // not hex
  })

  it("returns false for partial matches", () => {
    expect(containsEventLogRef("#session=")).toBe(false)
    expect(containsEventLogRef("session=default-123")).toBe(false) // missing #
    expect(containsEventLogRef("session/default-123")).toBe(false) // missing leading /
  })
})
