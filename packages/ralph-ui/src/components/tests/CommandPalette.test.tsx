import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CommandPalette } from "../CommandPalette"

describe("CommandPalette", () => {
  const defaultHandlers = {
    agentStart: vi.fn(),
    agentStop: vi.fn(),
    agentPause: vi.fn(),
    cycleTheme: vi.fn(),
    showHotkeys: vi.fn(),
    focusChatInput: vi.fn(),
    newSession: vi.fn(),
    toggleToolOutput: vi.fn(),
    scrollToBottom: vi.fn(),
    startRalph: vi.fn(),
    focusSearch: vi.fn(),
    previousTask: vi.fn(),
    nextTask: vi.fn(),
    openTask: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not render when closed", () => {
    render(<CommandPalette open={false} onClose={() => {}} handlers={{}} />)
    expect(screen.queryByPlaceholderText("Type a command or search...")).not.toBeInTheDocument()
  })

  it("renders when open", () => {
    render(<CommandPalette open={true} onClose={() => {}} handlers={defaultHandlers} />)
    expect(screen.getByPlaceholderText("Type a command or search...")).toBeInTheDocument()
  })

  it("includes hotkey actions like Focus chat input", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    expect(screen.getByText("Focus chat input")).toBeInTheDocument()
  })

  it("includes hotkey actions like Toggle tool output visibility", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    expect(screen.getByText("Toggle tool output visibility")).toBeInTheDocument()
  })

  it("includes hotkey actions like Scroll to bottom", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    expect(screen.getByText("Scroll to bottom")).toBeInTheDocument()
  })

  it("includes beads-view hotkey actions like Focus task search", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    expect(screen.getByText("Focus task search")).toBeInTheDocument()
  })

  it("displays keyboard shortcut labels for hotkey commands", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    // cmd+j for focusChatInput shows as "Ctrl+J" on non-Mac (jsdom)
    expect(screen.getByText("Ctrl+J")).toBeInTheDocument()
  })

  it("calls the correct handler when a hotkey command is selected", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    fireEvent.click(screen.getByText("Focus chat input"))
    expect(defaultHandlers.focusChatInput).toHaveBeenCalledTimes(1)
  })

  it("shows Start Ralph command when idle and connected", () => {
    render(
      <CommandPalette
        open={true}
        onClose={() => {}}
        handlers={defaultHandlers}
        controlState="idle"
        isConnected={true}
      />,
    )
    expect(screen.getByText("Start Ralph")).toBeInTheDocument()
  })
})
