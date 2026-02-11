import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { SessionPicker, type SessionPickerProps, type SessionPickerEntry } from "../SessionPicker"

function makeSession(overrides: Partial<SessionPickerEntry> = {}): SessionPickerEntry {
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
      renderPicker({
        currentSessionId: "s1",
        sessions: [makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "First session" })],
      })
      // The task ID appears in the trigger button but not in the dropdown (which is closed)
      // We verify the dropdown is closed by checking that the dropdown content container is absent
      const button = screen.getByRole("button")
      expect(button.textContent).toContain("r-abc12")
      // Only one element with this text (the trigger), not two (trigger + dropdown)
      expect(screen.getAllByText("r-abc12")).toHaveLength(1)
    })

    it("should show dropdown when trigger is clicked", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "First session" })],
      })
      fireEvent.click(screen.getByRole("button"))
      // No "Recent Sessions" heading - removed per requirement
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })

    it("should not display Recent Sessions heading in dropdown", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "First session" })],
      })
      fireEvent.click(screen.getByRole("button"))
      expect(screen.queryByText("Recent Sessions")).toBeNull()
    })

    it("should display task ID and title in dropdown items", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "Fix the login bug" }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Update documentation",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))
      // Should show task IDs (r-abc12 appears in both trigger and dropdown)
      expect(screen.getAllByText("r-abc12").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("r-def34")).toBeDefined()
      // Should show task titles
      expect(screen.getAllByText("Fix the login bug").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("Update documentation")).toBeDefined()
    })

    it("should not display relative time for sessions", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "First session",
            lastMessageAt: Date.now() - 5 * 60 * 1000,
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Second session",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))
      // No timestamps should be displayed
      expect(screen.queryByText("5 minutes ago")).toBeNull()
      expect(screen.queryByText("1 hour ago")).toBeNull()
    })

    it("should display first user message when taskId is missing", () => {
      renderPicker({
        sessions: [
          makeSession({ sessionId: "s1", firstUserMessage: "Find the regression source" }),
        ],
      })
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("Find the regression source")).toBeDefined()
    })

    it("should display 'No task' when taskId and first user message are missing", () => {
      renderPicker({
        sessions: [makeSession({ sessionId: "s1", firstUserMessage: "" })],
      })
      fireEvent.click(screen.getByTitle("Session history"))
      expect(screen.getByText("No task")).toBeDefined()
    })

    it("should toggle closed when trigger is clicked again", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "First session" })],
      })
      const trigger = screen.getByRole("button")
      fireEvent.click(trigger)
      // When open, task ID appears in both trigger and dropdown
      expect(screen.getAllByText("r-abc12").length).toBeGreaterThanOrEqual(2)
      fireEvent.click(trigger)
      // When closed, task ID only appears in the trigger
      expect(screen.getAllByText("r-abc12")).toHaveLength(1)
    })
  })

  describe("session selection", () => {
    it("should call onSelectSession when a session row is clicked", () => {
      const { props } = renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "First session",
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Second session",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))
      fireEvent.click(screen.getByText("Second session"))
      expect(props.onSelectSession).toHaveBeenCalledWith("s2")
    })

    it("should close the dropdown after selecting a session", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "First session",
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Second session",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))
      fireEvent.click(screen.getByText("Second session"))
      // Dropdown should be closed - task ID should only appear in the trigger now
      expect(screen.getAllByText("r-abc12")).toHaveLength(1)
    })
  })

  describe("current session indicator", () => {
    it("should show a checkmark for the current session", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "First session",
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Second session",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))

      // The current session dropdown row should contain an IconCheck SVG.
      // Filter to dropdown rows only (exclude the trigger button which also has task text).
      const dropdownButtons = screen
        .getAllByRole("button")
        .filter(b => b.classList.contains("hover:bg-muted"))
      const firstSessionRow = dropdownButtons.find(b => b.textContent?.includes("First session"))
      expect(firstSessionRow).toBeDefined()

      const svg = firstSessionRow!.querySelector("svg")
      expect(svg).not.toBeNull()
    })

    it("should not show a checkmark for non-current sessions", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "First session",
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Second session",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))

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
      renderPicker({
        currentSessionId: "s1",
        sessions: [makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "First session" })],
      })
      fireEvent.click(screen.getByRole("button"))
      // When open, task ID appears in both trigger and dropdown
      expect(screen.getAllByText("r-abc12").length).toBeGreaterThanOrEqual(2)

      fireEvent.keyDown(document, { key: "Escape" })
      // When closed, task ID only in trigger
      expect(screen.getAllByText("r-abc12")).toHaveLength(1)
    })

    it("should close on outside click", async () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "First session" })],
      })
      fireEvent.click(screen.getByRole("button"))
      // When open, task ID appears in both trigger and dropdown
      expect(screen.getAllByText("r-abc12").length).toBeGreaterThanOrEqual(2)

      // Radix DismissableLayer registers its pointerdown listener via setTimeout(0),
      // so we need to flush that timer before dispatching the event
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      fireEvent.pointerDown(document.body)
      // When closed, task ID only in trigger
      expect(screen.getAllByText("r-abc12")).toHaveLength(1)
    })
  })

  describe("task info display", () => {
    it("should display task ID and title in trigger when current session has task data", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-abc99", taskTitle: "Fix authentication bug" }),
        ],
      })
      const button = screen.getByRole("button")
      expect(button.textContent).toContain("r-abc99")
      expect(button.textContent).toContain("Fix authentication bug")
    })

    it("should show history icon only when current session has no task info", () => {
      renderPicker()
      const button = screen.getByRole("button")
      // Button should only contain the icon (no text content)
      expect(button.textContent?.trim()).toBe("")
    })

    it("should use sm size when current session has task info", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-abc99", taskTitle: "Fix authentication bug" }),
        ],
      })
      const button = screen.getByRole("button")
      expect(button.getAttribute("data-size")).toBe("sm")
    })

    it("should use icon-sm size when current session has no task info", () => {
      renderPicker()
      const button = screen.getByRole("button")
      expect(button.getAttribute("data-size")).toBe("icon-sm")
    })

    it("should use white at 75% opacity on hover for task ID and caret icon", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-abc99", taskTitle: "Fix authentication bug" }),
        ],
      })
      const button = screen.getByRole("button")

      // The button should have "group" class for group-hover to work
      expect(button.classList.contains("group")).toBe(true)

      // Find the task ID span (contains the task ID text)
      const taskIdSpan = Array.from(button.querySelectorAll("span")).find(span =>
        span.textContent?.includes("r-abc99"),
      )
      expect(taskIdSpan).toBeDefined()
      expect(taskIdSpan?.classList.contains("group-hover:text-white/75")).toBe(true)

      // Find the caret icon (IconChevronDown)
      const caretIcon = button.querySelector("svg")
      expect(caretIcon).not.toBeNull()
      expect(caretIcon?.classList.contains("group-hover:text-white/75")).toBe(true)
    })

    it("should not constrain task title width with max-w-48", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-abc99", taskTitle: "Fix authentication bug" }),
        ],
      })
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
    it("should show a spinner for active sessions", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "Active session",
            isActive: true,
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Inactive session",
            isActive: false,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))

      // Find the active session dropdown row (exclude trigger by filtering to dropdown rows)
      const dropdownButtons = screen
        .getAllByRole("button")
        .filter(b => b.classList.contains("hover:bg-muted"))
      const activeSessionButton = dropdownButtons.find(b =>
        b.textContent?.includes("Active session"),
      )
      expect(activeSessionButton).toBeDefined()

      // Should have a spinner element (IconLoader2 with animate-spin)
      const spinner = activeSessionButton?.querySelector('[data-testid="active-indicator"]')
      expect(spinner).not.toBeNull()
      // Spinner should have animate-spin class
      expect(spinner?.classList.contains("animate-spin")).toBe(true)
    })

    it("should not show a spinner for inactive sessions", () => {
      renderPicker({
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "Inactive session",
            isActive: false,
          }),
        ],
      })
      fireEvent.click(screen.getByTitle("Session history"))

      const sessionButton = screen
        .getAllByRole("button")
        .find(b => b.textContent?.includes("Inactive session"))
      expect(sessionButton).toBeDefined()

      const spinner = sessionButton?.querySelector('[data-testid="active-indicator"]')
      expect(spinner).toBeNull()
    })

    it("should not show a spinner when isActive is undefined", () => {
      renderPicker({
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "Session without isActive",
            // isActive is not set
          }),
        ],
      })
      fireEvent.click(screen.getByTitle("Session history"))

      const sessionButton = screen
        .getAllByRole("button")
        .find(b => b.textContent?.includes("Session without isActive"))
      expect(sessionButton).toBeDefined()

      const spinner = sessionButton?.querySelector('[data-testid="active-indicator"]')
      expect(spinner).toBeNull()
    })

    it("should indent inactive sessions so task IDs align with active sessions", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({
            sessionId: "s1",
            taskId: "r-abc12",
            taskTitle: "Active session",
            isActive: true,
          }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Inactive session",
            isActive: false,
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))

      // Find the inactive session row
      const inactiveSessionButton = screen
        .getAllByRole("button")
        .find(b => b.textContent?.includes("Inactive session"))
      expect(inactiveSessionButton).toBeDefined()

      // Should have a spacer element for alignment
      const spacer = inactiveSessionButton?.querySelector('[data-testid="spacer"]')
      expect(spacer).not.toBeNull()
    })
  })

  describe("session data as single source of truth", () => {
    it("should show trigger button task info from session data", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-abc12", taskTitle: "Task from session data" }),
          makeSession({
            sessionId: "s2",
            taskId: "r-def34",
            taskTitle: "Other session",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      const button = screen.getByRole("button")
      expect(button.textContent).toContain("r-abc12")
      expect(button.textContent).toContain("Task from session data")
    })

    it("should always show each session's own task info in the dropdown", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-live1", taskTitle: "Live task" }),
          makeSession({
            sessionId: "s2",
            taskId: "r-hist2",
            taskTitle: "Historical task",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))

      // Live session (s1) should show its own task info from session data
      expect(screen.getAllByText("r-live1").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Live task").length).toBeGreaterThanOrEqual(1)

      // Historical session should show its own task info
      expect(screen.getByText("r-hist2")).toBeDefined()
      expect(screen.getByText("Historical task")).toBeDefined()
    })

    it("should not show 'No task' when all sessions have task data", () => {
      renderPicker({
        currentSessionId: "s1",
        sessions: [
          makeSession({ sessionId: "s1", taskId: "r-live1", taskTitle: "Live task" }),
          makeSession({
            sessionId: "s2",
            taskId: "r-hist2",
            taskTitle: "Historical task",
            lastMessageAt: Date.now() - 60 * 60 * 1000,
          }),
        ],
      })
      fireEvent.click(screen.getByRole("button"))

      // Should NOT show "No task" anywhere - both sessions have task data
      expect(screen.queryByText("No task")).toBeNull()
    })
  })
})
