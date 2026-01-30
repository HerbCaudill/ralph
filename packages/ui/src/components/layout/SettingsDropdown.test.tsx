import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SettingsDropdown } from "./SettingsDropdown"
import type { ThemeMeta } from "@herbcaudill/agent-view-theme"
import * as exportStateModule from "@/lib/exportState"

// Mock values for useThemeCoordinator (combines useVSCodeTheme and useTheme)
const mockFetchThemes = vi.fn()
const mockApplyTheme = vi.fn()
const mockSetTheme = vi.fn()
const mockSetMode = vi.fn()
const mockCycleTheme = vi.fn()

let mockThemes: ThemeMeta[] = []
let mockActiveThemeId: string | null = null
let mockIsLoadingList = false
let mockIsLoadingTheme = false
let mockError: string | null = null
let mockTheme: "system" | "light" | "dark" = "system"

// Mock the hooks
vi.mock("@/hooks", () => ({
  useThemeCoordinator: () => ({
    // VS Code theme values
    themes: mockThemes,
    activeTheme: null,
    activeThemeId: mockActiveThemeId,
    variant: "VS Code",
    isLoadingList: mockIsLoadingList,
    isLoadingTheme: mockIsLoadingTheme,
    error: mockError,
    fetchThemes: mockFetchThemes,
    applyTheme: mockApplyTheme,
    // Light/dark theme values
    theme: mockTheme,
    resolvedTheme: mockTheme === "system" ? "dark" : mockTheme,
    setTheme: mockSetTheme,
    setMode: mockSetMode,
    cycleTheme: mockCycleTheme,
  }),
}))

// Helper to create standard mock themes
function createMockThemes(): ThemeMeta[] {
  return [
    {
      id: "gruvbox-dark",
      label: "Gruvbox Dark",
      type: "dark",
      path: "/path/to/gruvbox-dark.json",
      extensionId: "jdinhlife.gruvbox",
      extensionName: "Gruvbox Theme",
    },
    {
      id: "dracula",
      label: "Dracula",
      type: "dark",
      path: "/path/to/dracula.json",
      extensionId: "dracula-theme.theme-dracula",
      extensionName: "Dracula Official",
    },
    {
      id: "solarized-light",
      label: "Solarized Light",
      type: "light",
      path: "/path/to/solarized-light.json",
      extensionId: "ryanolsonx.solarized",
      extensionName: "Solarized",
    },
  ]
}

describe("SettingsDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock values
    mockThemes = createMockThemes()
    mockActiveThemeId = null
    mockIsLoadingList = false
    mockIsLoadingTheme = false
    mockError = null
    mockTheme = "system"
    // Clear mock function calls
    mockFetchThemes.mockClear()
    mockApplyTheme.mockClear()
    mockSetTheme.mockClear()
    mockSetMode.mockClear()
    mockCycleTheme.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders cog icon button", () => {
      render(<SettingsDropdown />)
      expect(screen.getByTestId("settings-dropdown-trigger")).toBeInTheDocument()
      expect(screen.getByLabelText("Settings")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(<SettingsDropdown className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("applies textColor to icon", () => {
      render(<SettingsDropdown textColor="#ffffff" />)
      const trigger = screen.getByTestId("settings-dropdown-trigger")
      expect(trigger).toHaveStyle({ color: "#ffffff" })
    })
  })

  describe("dropdown behavior", () => {
    it("opens dropdown when clicked", () => {
      render(<SettingsDropdown />)

      // Dropdown should be closed initially
      expect(screen.queryByTestId("settings-dropdown")).not.toBeInTheDocument()

      // Click the trigger button
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Dropdown should be open
      expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()
    })

    it("closes dropdown when clicking outside", async () => {
      render(<SettingsDropdown />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))
      expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()

      // Click outside
      fireEvent.mouseDown(document.body)

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("settings-dropdown")).not.toBeInTheDocument()
      })
    })

    it("closes dropdown when pressing Escape", async () => {
      render(<SettingsDropdown />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))
      expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" })

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("settings-dropdown")).not.toBeInTheDocument()
      })
    })
  })

  describe("appearance mode section", () => {
    it("shows all appearance mode buttons", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByTestId("settings-appearance-system")).toBeInTheDocument()
      expect(screen.getByTestId("settings-appearance-light")).toBeInTheDocument()
      expect(screen.getByTestId("settings-appearance-dark")).toBeInTheDocument()
    })

    it("highlights current appearance mode", () => {
      mockTheme = "light"
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      const lightButton = screen.getByTestId("settings-appearance-light")
      expect(lightButton).toHaveClass("bg-repo-accent")
    })

    it("calls setMode when clicking light/dark appearance mode button", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Clicking dark should use setMode (triggers theme restoration)
      fireEvent.click(screen.getByTestId("settings-appearance-dark"))
      expect(mockSetMode).toHaveBeenCalledWith("dark")

      // Clicking light should also use setMode
      fireEvent.click(screen.getByTestId("settings-appearance-light"))
      expect(mockSetMode).toHaveBeenCalledWith("light")
    })

    it("calls setTheme when clicking system appearance mode button", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Clicking system should use setTheme directly (no theme restoration)
      fireEvent.click(screen.getByTestId("settings-appearance-system"))
      expect(mockSetTheme).toHaveBeenCalledWith("system")
    })
  })

  describe("theme section", () => {
    it("shows themes matching current display mode (dark when resolvedTheme is dark)", () => {
      // With mockTheme = "system", resolvedTheme will be "dark"
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Should show dark themes
      expect(screen.getByText("Gruvbox Dark")).toBeInTheDocument()
      expect(screen.getByText("Dracula")).toBeInTheDocument()

      // Should NOT show light themes
      expect(screen.queryByText("Solarized Light")).not.toBeInTheDocument()
    })

    it("shows themes matching current display mode (light when resolvedTheme is light)", () => {
      mockTheme = "light"
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Should show light theme
      expect(screen.getByText("Solarized Light")).toBeInTheDocument()

      // Should NOT show dark themes
      expect(screen.queryByText("Gruvbox Dark")).not.toBeInTheDocument()
      expect(screen.queryByText("Dracula")).not.toBeInTheDocument()
    })
  })

  describe("theme selection", () => {
    it("calls applyTheme when clicking a theme item", async () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.click(screen.getByText("Dracula"))

      await waitFor(() => {
        expect(mockApplyTheme).toHaveBeenCalledWith("dracula")
      })
    })

    it("keeps dropdown open after selecting a theme", async () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.click(screen.getByText("Dracula"))

      // Dropdown should remain open
      await waitFor(() => {
        expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()
      })
    })
  })

  describe("loading states", () => {
    it("trigger button remains clickable when loading", () => {
      mockIsLoadingList = true
      render(<SettingsDropdown />)

      const trigger = screen.getByTestId("settings-dropdown-trigger")
      expect(trigger).not.toBeDisabled()
    })

    it("can open dropdown while loading", () => {
      mockIsLoadingList = true
      render(<SettingsDropdown />)

      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))
      expect(screen.getByTestId("settings-dropdown")).toBeInTheDocument()
    })
  })

  describe("error states", () => {
    it("shows error state when there is an error", () => {
      mockError = "Failed to load themes"
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByText("Failed to load themes")).toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    it("shows empty state when no themes available", () => {
      mockThemes = []
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })

  describe("export state functionality", () => {
    it("shows export state button in dropdown", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByTestId("settings-export-state")).toBeInTheDocument()
      expect(screen.getByText("Export state")).toBeInTheDocument()
    })

    it("calls downloadStateExport when clicking export state button", async () => {
      const mockDownload = vi
        .spyOn(exportStateModule, "downloadStateExport")
        .mockResolvedValue(undefined)

      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.click(screen.getByTestId("settings-export-state"))

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalled()
      })

      mockDownload.mockRestore()
    })

    it("shows exporting state while export is in progress", async () => {
      // Create a promise that we can control
      let resolveExport: () => void
      const exportPromise = new Promise<void>(resolve => {
        resolveExport = resolve
      })

      const mockDownload = vi
        .spyOn(exportStateModule, "downloadStateExport")
        .mockReturnValue(exportPromise)

      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Click export
      fireEvent.click(screen.getByTestId("settings-export-state"))

      // Should show exporting state
      await waitFor(() => {
        expect(screen.getByText("Exporting...")).toBeInTheDocument()
      })

      // Button should be disabled
      const button = screen.getByTestId("settings-export-state")
      expect(button).toBeDisabled()

      // Resolve the export
      resolveExport!()

      // Should return to normal state
      await waitFor(() => {
        expect(screen.getByText("Export state")).toBeInTheDocument()
      })

      mockDownload.mockRestore()
    })

    it("handles export errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const mockDownload = vi
        .spyOn(exportStateModule, "downloadStateExport")
        .mockRejectedValue(new Error("Export failed"))

      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.click(screen.getByTestId("settings-export-state"))

      // Should recover from error and show normal state
      await waitFor(() => {
        expect(screen.getByText("Export state")).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SettingsDropdown] Failed to export state:",
        expect.any(Error),
      )

      consoleSpy.mockRestore()
      mockDownload.mockRestore()
    })
  })
})
