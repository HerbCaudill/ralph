import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CommandPalette, type CommandAction } from "./CommandPalette"

describe("CommandPalette", () => {
  const mockHandlers: Partial<Record<CommandAction, () => void>> = {
    agentStart: vi.fn(),
    agentStop: vi.fn(),
    agentPause: vi.fn(),
    toggleSidebar: vi.fn(),
    cycleTheme: vi.fn(),
    showHotkeys: vi.fn(),
    focusTaskInput: vi.fn(),
    focusChatInput: vi.fn(),
    toggleTaskChat: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders command palette when open", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      expect(screen.getByTestId("command-palette")).toBeInTheDocument()
      expect(screen.getByTestId("command-input")).toBeInTheDocument()
    })

    it("does not render command palette when closed", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={false} onClose={onClose} handlers={mockHandlers} />)

      expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument()
    })

    it("displays command items", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="stopped"
          isConnected={true}
        />,
      )

      expect(screen.getByText("Start Ralph")).toBeInTheDocument()
      expect(screen.getByText("Toggle Sidebar")).toBeInTheDocument()
      expect(screen.getByText("Toggle Theme")).toBeInTheDocument()
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
      expect(screen.getByText("New Task")).toBeInTheDocument()
      expect(screen.getByText("Focus Chat")).toBeInTheDocument()
      expect(screen.getByText("Toggle Task Chat")).toBeInTheDocument()
    })

    it("displays command descriptions", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="stopped"
          isConnected={true}
        />,
      )

      expect(screen.getByText("Start the Ralph agent")).toBeInTheDocument()
      expect(screen.getByText("Show or hide the sidebar")).toBeInTheDocument()
    })

    it("displays keyboard shortcuts for commands", () => {
      const onClose = vi.fn()
      const { container } = render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="stopped"
          isConnected={true}
        />,
      )

      // Check that keyboard shortcuts are displayed (platform dependent)
      const shortcuts = container.querySelectorAll("kbd")
      expect(shortcuts.length).toBeGreaterThan(0)
    })

    it("shows search input with placeholder", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const input = screen.getByTestId("command-input")
      expect(input).toHaveAttribute("placeholder", "Type a command or search...")
    })
  })

  describe("conditional commands", () => {
    it("shows Start Ralph when stopped and connected", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="stopped"
          isConnected={true}
        />,
      )

      expect(screen.getByText("Start Ralph")).toBeInTheDocument()
      expect(screen.queryByText("Stop Ralph")).not.toBeInTheDocument()
    })

    it("shows Stop Ralph when running and connected", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="running"
          isConnected={true}
        />,
      )

      expect(screen.queryByText("Start Ralph")).not.toBeInTheDocument()
      expect(screen.getByText("Stop Ralph")).toBeInTheDocument()
    })

    it("shows Pause Ralph when running", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="running"
          isConnected={true}
        />,
      )

      expect(screen.getByText("Pause Ralph")).toBeInTheDocument()
    })

    it("shows Resume Ralph when paused", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="paused"
          isConnected={true}
        />,
      )

      expect(screen.getByText("Resume Ralph")).toBeInTheDocument()
    })

    it("hides agent commands when disconnected", () => {
      const onClose = vi.fn()
      render(
        <CommandPalette
          open={true}
          onClose={onClose}
          handlers={mockHandlers}
          ralphStatus="stopped"
          isConnected={false}
        />,
      )

      expect(screen.queryByText("Start Ralph")).not.toBeInTheDocument()
      expect(screen.queryByText("Stop Ralph")).not.toBeInTheDocument()
    })
  })

  describe("interactions", () => {
    it("calls handler when command is selected", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const toggleSidebarItem = screen.getByTestId("command-item-toggleSidebar")
      fireEvent.click(toggleSidebarItem)

      expect(mockHandlers.toggleSidebar).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("closes when clicking backdrop", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const backdrop = screen.getByTestId("command-backdrop")
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("filters commands based on search input", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const input = screen.getByTestId("command-input")
      fireEvent.change(input, { target: { value: "sidebar" } })

      // Commands containing "sidebar" should be visible
      expect(screen.getByText("Toggle Sidebar")).toBeInTheDocument()
      // Other commands should be hidden
      expect(screen.queryByText("Toggle Theme")).not.toBeInTheDocument()
    })

    it("filters commands by keywords", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const input = screen.getByTestId("command-input")
      fireEvent.change(input, { target: { value: "dark" } })

      // Theme command has "dark" as a keyword
      expect(screen.getByText("Toggle Theme")).toBeInTheDocument()
    })

    it("shows empty state when no commands match", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const input = screen.getByTestId("command-input")
      fireEvent.change(input, { target: { value: "nonexistent" } })

      expect(screen.getByText("No commands found.")).toBeInTheDocument()
    })

    it("resets search when reopened", () => {
      const onClose = vi.fn()
      const { rerender } = render(
        <CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />,
      )

      const input = screen.getByTestId("command-input")
      fireEvent.change(input, { target: { value: "sidebar" } })

      // Close and reopen
      rerender(<CommandPalette open={false} onClose={onClose} handlers={mockHandlers} />)
      rerender(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const newInput = screen.getByTestId("command-input")
      expect(newInput).toHaveValue("")
    })
  })

  describe("accessibility", () => {
    it("has accessible search input", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const input = screen.getByTestId("command-input")
      expect(input).toBeInTheDocument()
    })

    it("autofocuses input when opened", () => {
      const onClose = vi.fn()
      render(<CommandPalette open={true} onClose={onClose} handlers={mockHandlers} />)

      const input = screen.getByTestId("command-input")
      expect(input).toHaveFocus()
    })
  })
})
