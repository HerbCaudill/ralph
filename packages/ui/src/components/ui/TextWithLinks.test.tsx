import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TextWithLinks } from "./TextWithLinks"
import { AgentViewTestWrapper, defaultTestContext } from "@/test/agentViewTestWrapper"
import type { AgentViewContextValue } from "@herbcaudill/agent-view"

describe("TextWithLinks", () => {
  const mockSessionClick = vi.fn()

  /** Render with AgentViewProvider context. */
  function renderWithContext(ui: React.ReactElement, overrides?: Partial<AgentViewContextValue>) {
    return render(
      <AgentViewTestWrapper
        value={{
          ...overrides,
          linkHandlers: {
            ...defaultTestContext.linkHandlers,
            onSessionClick: mockSessionClick,
            ...overrides?.linkHandlers,
          },
        }}
      >
        {ui}
      </AgentViewTestWrapper>,
    )
  }

  afterEach(() => {
    vi.restoreAllMocks()
    mockSessionClick.mockReset()
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
      renderWithContext(<TextWithLinks>Check out rui-48s for details</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View task rui-48s" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("48s")
      expect(link).toHaveAttribute("href", "/issue/rui-48s")
    })

    it("handles task IDs with decimal suffixes", () => {
      renderWithContext(<TextWithLinks>See rui-4vp.5 for the subtask</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View task rui-4vp.5" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("4vp.5")
      expect(link).toHaveAttribute("href", "/issue/rui-4vp.5")
    })
  })

  describe("session linking", () => {
    it("converts session path reference to clickable link (new format)", () => {
      renderWithContext(<TextWithLinks>Session: /session/default-1706123456789</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session default-1706123456789" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("/session/default-1706123456789")
    })

    it("converts legacy #session= reference to clickable link", () => {
      renderWithContext(<TextWithLinks>Session: #session=default-1706123456789</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session default-1706123456789" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#session=default-1706123456789")
    })

    it("converts legacy #eventlog= reference to clickable link", () => {
      renderWithContext(<TextWithLinks>Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session abcdef12" })
      expect(link).toBeInTheDocument()
      expect(link).toHaveTextContent("#eventlog=abcdef12")
    })

    it("navigates to session path when clicked (new format)", () => {
      renderWithContext(<TextWithLinks>Click /session/default-123 here</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session default-123" })
      fireEvent.click(link)

      expect(mockSessionClick).toHaveBeenCalledWith("default-123")
    })

    it("navigates to session path when clicking legacy #session= format", () => {
      renderWithContext(<TextWithLinks>Click #session=default-123 here</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session default-123" })
      fireEvent.click(link)

      expect(mockSessionClick).toHaveBeenCalledWith("default-123")
    })

    it("navigates to session path when clicking legacy #eventlog= format", () => {
      renderWithContext(<TextWithLinks>Click #eventlog=abcdef12 here</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session abcdef12" })
      fireEvent.click(link)

      expect(mockSessionClick).toHaveBeenCalledWith("abcdef12")
    })

    it("handles uppercase hex characters in legacy format", () => {
      renderWithContext(<TextWithLinks>Ref: #eventlog=ABCDEF00</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session ABCDEF00" })
      expect(link).toBeInTheDocument()
    })
  })

  describe("mixed content", () => {
    it("handles both task IDs and session references in same text", () => {
      renderWithContext(
        <TextWithLinks>Task rui-48s has session /session/default-123</TextWithLinks>,
      )

      const taskLink = screen.getByRole("link", { name: "View task rui-48s" })
      const sessionLink = screen.getByRole("link", { name: "View session default-123" })

      expect(taskLink).toBeInTheDocument()
      expect(taskLink).toHaveAttribute("href", "/issue/rui-48s")
      expect(sessionLink).toBeInTheDocument()

      // Click session link
      fireEvent.click(sessionLink)
      expect(mockSessionClick).toHaveBeenCalledWith("default-123")
    })

    it("handles task IDs with legacy eventlog references", () => {
      renderWithContext(
        <TextWithLinks>Task rui-48s has event log #eventlog=abcdef12</TextWithLinks>,
      )

      const taskLink = screen.getByRole("link", { name: "View task rui-48s" })
      const sessionLink = screen.getByRole("link", { name: "View session abcdef12" })

      expect(taskLink).toBeInTheDocument()
      expect(sessionLink).toBeInTheDocument()
    })

    it("preserves text between links", () => {
      const { container } = renderWithContext(
        <TextWithLinks>Start rui-1 middle /session/session-1 end</TextWithLinks>,
      )

      // Task ID displayed without prefix
      expect(container.textContent).toBe("Start 1 middle /session/session-1 end")
    })

    it("handles multiple of each type", () => {
      renderWithContext(
        <TextWithLinks>
          Tasks rui-1 and rui-2 with sessions /session/session-1 and /session/session-2
        </TextWithLinks>,
      )

      expect(screen.getByRole("link", { name: "View task rui-1" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View task rui-2" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View session session-1" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "View session session-2" })).toBeInTheDocument()
    })
  })

  describe("event propagation", () => {
    it("stops event propagation when clicking session link", () => {
      const parentClick = vi.fn()

      render(
        <AgentViewTestWrapper
          value={{
            linkHandlers: {
              ...defaultTestContext.linkHandlers,
              onSessionClick: mockSessionClick,
            },
          }}
        >
          <div onClick={parentClick}>
            <TextWithLinks>Click #session=default-123 here</TextWithLinks>
          </div>
        </AgentViewTestWrapper>,
      )

      const link = screen.getByRole("link", { name: "View session default-123" })
      fireEvent.click(link)

      expect(parentClick).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("does not linkify task IDs when no prefix is configured", () => {
      renderWithContext(<TextWithLinks>Check rui-48s and /session/default-123</TextWithLinks>, {
        linkHandlers: {
          taskIdPrefix: null,
          onSessionClick: mockSessionClick,
          buildSessionHref: (id: string) => `/session/${id}`,
        },
      })

      // Task link should not exist (no prefix)
      expect(screen.queryByRole("link", { name: "View task rui-48s" })).not.toBeInTheDocument()

      // Session link should still work
      expect(screen.getByRole("link", { name: "View session default-123" })).toBeInTheDocument()
    })

    it("does not linkify invalid legacy eventlog references", () => {
      renderWithContext(<TextWithLinks>#eventlog=abc is too short</TextWithLinks>)

      // No session links (eventlog hash must be exactly 8 hex chars)
      const links = screen.queryAllByRole("link")
      expect(links).toHaveLength(0)
    })

    it("handles closing comment format with new session path format", () => {
      renderWithContext(<TextWithLinks>Closed. Session log: /session/default-123</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session default-123" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(mockSessionClick).toHaveBeenCalledWith("default-123")
    })

    it("handles closing comment format with legacy #session= format", () => {
      renderWithContext(<TextWithLinks>Closed. Session: #session=default-123</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session default-123" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(mockSessionClick).toHaveBeenCalledWith("default-123")
    })

    it("handles closing comment format with legacy #eventlog= format", () => {
      renderWithContext(<TextWithLinks>Closed. Event log: #eventlog=abcdef12</TextWithLinks>)

      const link = screen.getByRole("link", { name: "View session abcdef12" })
      expect(link).toBeInTheDocument()

      fireEvent.click(link)
      expect(mockSessionClick).toHaveBeenCalledWith("abcdef12")
    })
  })
})
