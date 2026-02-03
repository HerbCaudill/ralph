import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Header } from "../Header"

// Mock the WorkspaceSelector from beads-view
vi.mock("@herbcaudill/beads-view", () => ({
  WorkspaceSelector: ({
    current,
    workspaces,
    isLoading,
  }: {
    current: { name: string } | null
    workspaces: unknown[]
    isLoading: boolean
  }) => (
    <div data-testid="workspace-selector">
      {isLoading ? "Loading..." : (current?.name ?? "No workspace")}
      {workspaces.length > 0 && <span> ({workspaces.length} workspaces)</span>}
    </div>
  ),
}))

// Mock the SettingsDropdown
vi.mock("../SettingsDropdown", () => ({
  SettingsDropdown: ({ textColor }: { textColor: string }) => (
    <button data-testid="settings-dropdown" style={{ color: textColor }}>
      Settings
    </button>
  ),
}))

// Mock the HelpButton
vi.mock("../HelpButton", () => ({
  HelpButton: ({ textColor, onClick }: { textColor: string; onClick: () => void }) => (
    <button data-testid="help-button" style={{ color: textColor }} onClick={onClick}>
      Help
    </button>
  ),
}))

// Mock the Logo component
vi.mock("../Logo", () => ({
  Logo: () => <div data-testid="logo">Ralph</div>,
}))

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders with logo, workspace selector, help button, and settings", () => {
    const mockWorkspace = { path: "/test", name: "Test Workspace" }

    render(
      <Header
        accentColor="#007ACC"
        workspace={mockWorkspace}
        workspaces={[mockWorkspace]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    expect(screen.getByTestId("header")).toBeInTheDocument()
    expect(screen.getByTestId("logo")).toBeInTheDocument()
    expect(screen.getByTestId("workspace-selector")).toBeInTheDocument()
    expect(screen.getByTestId("help-button")).toBeInTheDocument()
    expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()
  })

  it("applies accent color as background", () => {
    render(
      <Header
        accentColor="#FF5733"
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    const header = screen.getByTestId("header")
    expect(header).toHaveStyle({ backgroundColor: "#FF5733" })
  })

  it("uses default accent color when accentColor is null", () => {
    render(
      <Header
        accentColor={null}
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    const header = screen.getByTestId("header")
    expect(header).toHaveStyle({ backgroundColor: "#374151" })
  })

  it("uses contrasting text color for dark backgrounds", () => {
    render(
      <Header
        accentColor="#1E1E1E"
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    // Settings dropdown should receive white text color
    const settings = screen.getByTestId("settings-dropdown")
    expect(settings).toHaveStyle({ color: "#ffffff" })
  })

  it("uses contrasting text color for light backgrounds", () => {
    render(
      <Header
        accentColor="#FFFFFF"
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    // Settings dropdown should receive black text color
    const settings = screen.getByTestId("settings-dropdown")
    expect(settings).toHaveStyle({ color: "#000000" })
  })

  it("passes workspace data to WorkspaceSelector", () => {
    const mockWorkspace = { path: "/project", name: "My Project" }
    const mockWorkspaces = [mockWorkspace, { path: "/other", name: "Other Project" }]

    render(
      <Header
        accentColor="#007ACC"
        workspace={mockWorkspace}
        workspaces={mockWorkspaces}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    const selector = screen.getByTestId("workspace-selector")
    expect(selector).toHaveTextContent("My Project")
    expect(selector).toHaveTextContent("(2 workspaces)")
  })

  it("shows loading state in WorkspaceSelector", () => {
    render(
      <Header
        accentColor="#007ACC"
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={true}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    const selector = screen.getByTestId("workspace-selector")
    expect(selector).toHaveTextContent("Loading...")
  })

  it("accepts custom className", () => {
    render(
      <Header
        className="custom-class"
        accentColor="#007ACC"
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={() => {}}
      />,
    )

    const header = screen.getByTestId("header")
    expect(header).toHaveClass("custom-class")
  })

  it("calls onHelpClick when help button is clicked", () => {
    const handleHelpClick = vi.fn()

    render(
      <Header
        accentColor="#007ACC"
        workspace={null}
        workspaces={[]}
        isWorkspaceLoading={false}
        onWorkspaceSwitch={() => {}}
        onHelpClick={handleHelpClick}
      />,
    )

    fireEvent.click(screen.getByTestId("help-button"))
    expect(handleHelpClick).toHaveBeenCalledTimes(1)
  })
})
