import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
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
      makeSession({ sessionId: "s1", firstUserMessage: "First session", lastMessageAt: Date.now() - 5 * 60 * 1000 }),
      makeSession({ sessionId: "s2", firstUserMessage: "Second session", lastMessageAt: Date.now() - 60 * 60 * 1000 }),
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
      const sessionButtons = screen.getAllByRole("button").filter(b => b.textContent?.includes("First session"))
      expect(sessionButtons).toHaveLength(1)

      const svg = sessionButtons[0].querySelector("svg")
      expect(svg).not.toBeNull()
    })

    it("should not show a checkmark for non-current sessions", () => {
      renderPicker({ currentSessionId: "s1" })
      fireEvent.click(screen.getByTitle("Session history"))

      const sessionButtons = screen.getAllByRole("button").filter(b => b.textContent?.includes("Second session"))
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

    it("should close on outside click", () => {
      renderPicker()
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("Recent Sessions")).toBeDefined()

      fireEvent.mouseDown(document.body)
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })
  })
})
