import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SettingsDropdown } from "./SettingsDropdown"
import type { ThemeMeta } from "@/lib/theme"

// Mock values for useThemeCoordinator (combines useVSCodeTheme and useTheme)
const mockFetchThemes = vi.fn()
const mockApplyTheme = vi.fn()
const mockPreviewTheme = vi.fn()
const mockClearPreview = vi.fn()
const mockResetToDefault = vi.fn()
const mockSetTheme = vi.fn()
const mockSetMode = vi.fn()
const mockCycleTheme = vi.fn()

let mockThemes: ThemeMeta[] = []
let mockActiveThemeId: string | null = null
let mockCurrentVSCodeTheme: string | null = "Gruvbox Dark"
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
    currentVSCodeTheme: mockCurrentVSCodeTheme,
    variant: "VS Code",
    isLoadingList: mockIsLoadingList,
    isLoadingTheme: mockIsLoadingTheme,
    error: mockError,
    fetchThemes: mockFetchThemes,
    applyTheme: mockApplyTheme,
    previewTheme: mockPreviewTheme,
    clearPreview: mockClearPreview,
    resetToDefault: mockResetToDefault,
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
    mockCurrentVSCodeTheme = "Gruvbox Dark"
    mockIsLoadingList = false
    mockIsLoadingTheme = false
    mockError = null
    mockTheme = "system"
    // Clear mock function calls
    mockFetchThemes.mockClear()
    mockApplyTheme.mockClear()
    mockPreviewTheme.mockClear()
    mockClearPreview.mockClear()
    mockResetToDefault.mockClear()
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
      expect(lightButton).toHaveClass("bg-accent")
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
    it("shows Default option in dropdown", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByTestId("settings-theme-default")).toBeInTheDocument()
    })

    it("shows current VS Code theme info", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByText("VS Code: Gruvbox Dark")).toBeInTheDocument()
    })

    it("displays theme name in header", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByText("Theme: Default")).toBeInTheDocument()
    })

    it("displays active theme name when theme is selected", () => {
      mockActiveThemeId = "dracula"
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      expect(screen.getByText("Theme: Dracula")).toBeInTheDocument()
    })

    it("groups themes by dark and light types", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Use getAllByText since "Dark" and "Light" appear in both appearance mode and theme groups
      expect(screen.getAllByText("Dark").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Light").length).toBeGreaterThan(0)
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

    it("calls resetToDefault when clicking Default option", () => {
      mockActiveThemeId = "dracula"
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.click(screen.getByTestId("settings-theme-default"))

      expect(mockResetToDefault).toHaveBeenCalled()
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

  describe("preview functionality", () => {
    it("calls previewTheme on hover", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.mouseEnter(screen.getByText("Dracula"))

      expect(mockPreviewTheme).toHaveBeenCalledWith("dracula")
    })

    it("calls clearPreview on mouse leave", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.mouseEnter(screen.getByText("Dracula"))
      fireEvent.mouseLeave(screen.getByText("Dracula"))

      expect(mockClearPreview).toHaveBeenCalled()
    })
  })

  describe("refresh functionality", () => {
    it("calls fetchThemes when clicking refresh", () => {
      render(<SettingsDropdown />)
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      fireEvent.click(screen.getByText("Refresh themes"))

      expect(mockFetchThemes).toHaveBeenCalled()
    })
  })

  describe("loading states", () => {
    it("disables trigger button when loading", () => {
      mockIsLoadingList = true
      render(<SettingsDropdown />)

      const trigger = screen.getByTestId("settings-dropdown-trigger")
      expect(trigger).toBeDisabled()
    })

    it("shows opacity when loading", () => {
      mockIsLoadingList = true
      render(<SettingsDropdown />)

      const trigger = screen.getByTestId("settings-dropdown-trigger")
      expect(trigger).toHaveClass("opacity-70")
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
})
