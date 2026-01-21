import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EventLogLink, containsEventLogRef } from "./EventLogLink"

describe("EventLogLink", () => {
  const originalHash = window.location.hash

  beforeEach(() => {
    window.location.hash = ""
  })

  afterEach(() => {
    window.location.hash = originalHash
  })

  describe("rendering", () => {
    it("renders text without eventlog references unchanged", () => {
      render(<EventLogLink>Hello world</EventLogLink>)
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })

    it("renders empty string correctly", () => {
      const { container } = render(<EventLogLink>{""}</EventLogLink>)
      expect(container.textContent).toBe("")
    })

    it("converts eventlog reference to clickable link", () => {
      render(<EventLogLink>Event log: #eventlog=abcdef12</EventLogLink>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#eventlog=abcdef12")
    })

    it("handles multiple eventlog references in same text", () => {
      render(
        <EventLogLink>See #eventlog=abcdef12 and also #eventlog=12345678 for details</EventLogLink>,
      )

      const link1 = screen.getByRole("button", { name: "View event log abcdef12" })
      const link2 = screen.getByRole("button", { name: "View event log 12345678" })

      expect(link1).toBeInTheDocument()
      expect(link2).toBeInTheDocument()
    })

    it("preserves text before, between, and after eventlog references", () => {
      const { container } = render(
        <EventLogLink>Start #eventlog=11111111 middle #eventlog=22222222 end</EventLogLink>,
      )

      expect(container.textContent).toBe("Start #eventlog=11111111 middle #eventlog=22222222 end")
    })

    it("handles uppercase hex characters", () => {
      render(<EventLogLink>Ref: #eventlog=ABCDEF00</EventLogLink>)

      const link = screen.getByRole("button", { name: "View event log ABCDEF00" })
      expect(link).toBeInTheDocument()
    })

    it("handles mixed case hex characters", () => {
      render(<EventLogLink>Ref: #eventlog=AbCdEf12</EventLogLink>)

      const link = screen.getByRole("button", { name: "View event log AbCdEf12" })
      expect(link).toBeInTheDocument()
    })
  })

  describe("invalid patterns", () => {
    it("does not linkify IDs with too few characters", () => {
      render(<EventLogLink>#eventlog=abc is too short</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify IDs with too many characters", () => {
      render(<EventLogLink>#eventlog=abcdef123 is too long</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify IDs with non-hex characters", () => {
      render(<EventLogLink>#eventlog=ghijklmn is not hex</EventLogLink>)

      const buttons = screen.queryAllByRole("button")
      expect(buttons).toHaveLength(0)
    })

    it("does not linkify empty eventlog reference", () => {
      render(<EventLogLink>#eventlog= is empty</EventLogLink>)

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
    it("navigates to eventlog hash when clicked", () => {
      render(<EventLogLink>Click #eventlog=abcdef12 here</EventLogLink>)

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      fireEvent.click(link)

      expect(window.location.hash).toBe("#eventlog=abcdef12")
    })

    it("stops event propagation when clicking eventlog link", () => {
      const parentClick = vi.fn()

      render(
        <div onClick={parentClick}>
          <EventLogLink>Click #eventlog=abcdef12 here</EventLogLink>
        </div>,
      )

      const link = screen.getByRole("button", { name: "View event log abcdef12" })
      fireEvent.click(link)

      expect(parentClick).not.toHaveBeenCalled()
    })
  })
})

describe("containsEventLogRef", () => {
  it("returns true for text containing a valid eventlog reference", () => {
    expect(containsEventLogRef("Event log: #eventlog=abcdef12")).toBe(true)
    expect(containsEventLogRef("#eventlog=12345678")).toBe(true)
    expect(containsEventLogRef("See #eventlog=ABCDEF00 for details")).toBe(true)
  })

  it("returns false for text without eventlog references", () => {
    expect(containsEventLogRef("Hello world")).toBe(false)
    expect(containsEventLogRef("")).toBe(false)
    expect(containsEventLogRef("#eventlog=abc")).toBe(false) // too short
    expect(containsEventLogRef("#eventlog=abcdef123")).toBe(false) // too long
    expect(containsEventLogRef("#eventlog=ghijklmn")).toBe(false) // not hex
  })

  it("returns false for partial matches", () => {
    expect(containsEventLogRef("#eventlog=")).toBe(false)
    expect(containsEventLogRef("eventlog=abcdef12")).toBe(false) // missing #
  })
})
