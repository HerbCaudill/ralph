import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { SessionPicker, type SessionPickerProps } from "../SessionPicker"
import type { SessionIndexEntry } from "../../lib/sessionIndex"

function makeSession(overrides: Partial<SessionIndexEntry> = {}): SessionIndexEntry {
  return {
    sessionId: "s1",
    adapter: "claude",
    firstMessageAt: 1000,
    lastMessageAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    firstUserMessage: "Hello world",
    ...overrides,
  }
}

function renderPicker(overrides: Partial<SessionPickerProps> = {}) {
  const props: SessionPickerProps = {
    sessions: [
      makeSession({
        sessionId: "s1",
        firstUserMessage: "First session",
        lastMessageAt: Date.now() - 5 * 60 * 1000,
      }),
      makeSession({
        sessionId: "s2",
        firstUserMessage: "Second session",
        lastMessageAt: Date.now() - 60 * 60 * 1000,
      }),
    ],
    currentSessionId: "s1",
    onSelectSession: vi.fn(),
    ...overrides,
  }
  const result = render(<SessionPicker {...props} />)
  return { ...result, props }
}

describe("SessionPicker", () => {
  afterEach(() => {
    cleanup()
  })

  describe("shared component usage", () => {
    it("should use the shared Button component for the trigger", () => {
      renderPicker()
      const button = screen.getByRole("button")
      expect(button.getAttribute("data-slot")).toBe("button")
    })

    it("should use outline variant and icon-sm size for the trigger button", () => {
      renderPicker()
      const button = screen.getByRole("button")
      expect(button.getAttribute("data-variant")).toBe("outline")
      expect(button.getAttribute("data-size")).toBe("icon-sm")
    })
  })

  describe("trigger button", () => {
    it("should render a trigger button", () => {
      renderPicker()
      const button = screen.getByRole("button")
      expect(button).toBeDefined()
    })

    it("should have 'Session history' title when sessions exist", () => {
      renderPicker()
      const button = screen.getByTitle("Session history")
      expect(button).toBeDefined()
    })

    it("should have 'No previous sessions' title when sessions are empty", () => {
      renderPicker({ sessions: [] })
      const button = screen.getByTitle("No previous sessions")
      expect(button).toBeDefined()
    })

    it("should be disabled when sessions are empty", () => {
      renderPicker({ sessions: [] })
      const button = screen.getByRole("button")
      expect(button).toHaveProperty("disabled", true)
    })

    it("should be disabled when disabled prop is true", () => {
      renderPicker({ disabled: true })
      const button = screen.getByRole("button")
      expect(button).toHaveProperty("disabled", true)
    })

    it("should not be disabled when there are sessions and disabled is false", () => {
      renderPicker()
      const button = screen.getByTitle("Session history")
      expect(button).toHaveProperty("disabled", false)
    })
  })

  describe("dropdown", () => {
    it("should not show dropdown by default", () => {
      renderPicker()
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })

    it("should show dropdown when trigger is clicked", () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("Recent Sessions")).toBeDefined()
    })

    it("should display session text", () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("First session")).toBeDefined()
      expect(screen.getByText("Second session")).toBeDefined()
    })

    it("should display relative time for sessions", () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("5 minutes ago")).toBeDefined()
      expect(screen.getByText("1 hour ago")).toBeDefined()
    })

    it("should display 'Empty session' for sessions without a first user message", () => {
      renderPicker({
        sessions: [makeSession({ sessionId: "s1", firstUserMessage: "" })],
      })
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("Empty session")).toBeDefined()
    })

    it("should toggle closed when trigger is clicked again", () => {
      renderPicker()
      const trigger = screen.getByTitle("Session history")
      fireEvent.click(trigger)
      expect(screen.getByText("Recent Sessions")).toBeDefined()
      fireEvent.click(trigger)
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })
  })

  describe("session selection", () => {
    it("should call onSelectSession when a session row is clicked", () => {
      const { props } = renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      fireEvent.click(screen.getByText("Second session"))
      expect(props.onSelectSession).toHaveBeenCalledWith("s2")
    })

    it("should close the dropdown after selecting a session", () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      fireEvent.click(screen.getByText("Second session"))
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })
  })

  describe("current session indicator", () => {
    it("should show a checkmark for the current session", () => {
      renderPicker({ currentSessionId: "s1" })
      fireEvent.click(screen.getByTitle("Session history"))

      // The current session row should contain an SVG (the IconCheck)
      const sessionButtons = screen
        .getAllByRole("button")
        .filter(b => b.textContent?.includes("First session"))
      expect(sessionButtons).toHaveLength(1)

      const svg = sessionButtons[0].querySelector("svg")
      expect(svg).not.toBeNull()
    })

    it("should not show a checkmark for non-current sessions", () => {
      renderPicker({ currentSessionId: "s1" })
      fireEvent.click(screen.getByTitle("Session history"))

      const sessionButtons = screen
        .getAllByRole("button")
        .filter(b => b.textContent?.includes("Second session"))
      expect(sessionButtons).toHaveLength(1)

      const svg = sessionButtons[0].querySelector("svg")
      expect(svg).toBeNull()
    })
  })

  describe("closing behavior", () => {
    it("should close on Escape key", () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("Recent Sessions")).toBeDefined()

      fireEvent.keyDown(document, { key: "Escape" })
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })

    it("should close on outside click", async () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("Recent Sessions")).toBeDefined()

      // Radix DismissableLayer registers its pointerdown listener via setTimeout(0),
      // so we need to flush that timer before dispatching the event
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      fireEvent.pointerDown(document.body)
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })
  })

  describe("task info display", () => {
    it("should display task ID and title when provided", () => {
      renderPicker({ taskId: "r-abc99", taskTitle: "Fix authentication bug" })
      const button = screen.getByRole("button")
      expect(button.textContent).toContain("r-abc99")
      expect(button.textContent).toContain("Fix authentication bug")
    })

    it("should display only task ID when title is not provided", () => {
      renderPicker({ taskId: "r-abc99" })
      const button = screen.getByRole("button")
      expect(button.textContent).toContain("r-abc99")
    })

    it("should show history icon only when no task info is provided", () => {
      renderPicker()
      const button = screen.getByRole("button")
      // Button should only contain the icon (no text content)
      expect(button.textContent?.trim()).toBe("")
    })

    it("should use sm size when task info is provided", () => {
      renderPicker({ taskId: "r-abc99", taskTitle: "Fix authentication bug" })
      const button = screen.getByRole("button")
      expect(button.getAttribute("data-size")).toBe("sm")
    })

    it("should use icon-sm size when no task info is provided", () => {
      renderPicker()
      const button = screen.getByRole("button")
      expect(button.getAttribute("data-size")).toBe("icon-sm")
    })

    it("should not constrain task title width with max-w-48", () => {
      renderPicker({ taskId: "r-abc99", taskTitle: "Fix authentication bug" })
      const button = screen.getByRole("button")
      // Find the task title span (contains the title text, not the task ID)
      const titleSpan = Array.from(button.querySelectorAll("span")).find(span =>
        span.textContent?.includes("Fix authentication bug"),
      )
      expect(titleSpan).toBeDefined()
      // Should not have max-w-48 class which constrains width
      // Instead should have min-w-0 to allow natural shrinking while using available space
      expect(titleSpan?.classList.contains("max-w-48")).toBe(false)
    })
  })

  describe("active session indicator", () => {
    it("should show a pulsing green dot for active sessions", () => {
      renderPicker({
        sessions: [
          makeSession({
            sessionId: "s1",
            firstUserMessage: "Active session",
            isActive: true,
          }),
          makeSession({
            sessionId: "s2",
            firstUserMessage: "Inactive session",
            isActive: false,
          }),
        ],
      })
      fireEvent.click(screen.getByTitle("Session history"))

      // Find the active session row
      const activeSessionButton = screen
        .getAllByRole("button")
        .find(b => b.textContent?.includes("Active session"))
      expect(activeSessionButton).toBeDefined()

      // Should have a pulsing dot element
      const pulsingDot = activeSessionButton?.querySelector('[data-testid="active-indicator"]')
      expect(pulsingDot).not.toBeNull()
    })

    it("should not show a pulsing dot for inactive sessions", () => {
      renderPicker({
        sessions: [
          makeSession({
            sessionId: "s1",
            firstUserMessage: "Inactive session",
            isActive: false,
          }),
        ],
      })
      fireEvent.click(screen.getByTitle("Session history"))

      const sessionButton = screen
        .getAllByRole("button")
        .find(b => b.textContent?.includes("Inactive session"))
      expect(sessionButton).toBeDefined()

      const pulsingDot = sessionButton?.querySelector('[data-testid="active-indicator"]')
      expect(pulsingDot).toBeNull()
    })

    it("should not show a pulsing dot when isActive is undefined", () => {
      renderPicker({
        sessions: [
          makeSession({
            sessionId: "s1",
            firstUserMessage: "Session without isActive",
            // isActive is not set
          }),
        ],
      })
      fireEvent.click(screen.getByTitle("Session history"))

      const sessionButton = screen
        .getAllByRole("button")
        .find(b => b.textContent?.includes("Session without isActive"))
      expect(sessionButton).toBeDefined()

      const pulsingDot = sessionButton?.querySelector('[data-testid="active-indicator"]')
      expect(pulsingDot).toBeNull()
    })
  })
})
