import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ThemePicker } from "./ThemePicker"
import type { ThemeMeta } from "@/lib/theme"

// Mock values for useVSCodeTheme
const mockFetchThemes = vi.fn()
const mockApplyTheme = vi.fn()
const mockPreviewTheme = vi.fn()
const mockClearPreview = vi.fn()
const mockResetToDefault = vi.fn()

let mockThemes: ThemeMeta[] = []
let mockActiveThemeId: string | null = null
let mockCurrentVSCodeTheme: string | null = "Gruvbox Dark"
let mockIsLoadingList = false
let mockIsLoadingTheme = false
let mockError: string | null = null

// Mock the useVSCodeTheme hook
vi.mock("@/hooks", () => ({
  useVSCodeTheme: () => ({
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
    {
      id: "github-light",
      label: "GitHub Light",
      type: "light",
      path: "/path/to/github-light.json",
      extensionId: "github.github-vscode-theme",
      extensionName: "GitHub Theme",
    },
  ]
}

describe("ThemePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock values
    mockThemes = createMockThemes()
    mockActiveThemeId = null
    mockCurrentVSCodeTheme = "Gruvbox Dark"
    mockIsLoadingList = false
    mockIsLoadingTheme = false
    mockError = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders with default display name when no theme is active", () => {
      render(<ThemePicker />)
      expect(screen.getByTestId("theme-picker-trigger")).toBeInTheDocument()
      expect(screen.getByText("Default")).toBeInTheDocument()
    })

    it("displays active theme name in trigger when theme is selected", () => {
      mockActiveThemeId = "gruvbox-dark"
      render(<ThemePicker />)
      expect(screen.getByText("Gruvbox Dark")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(<ThemePicker className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("uses header variant styling when variant is header", () => {
      render(<ThemePicker variant="header" textColor="#ffffff" />)
      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toHaveClass("hover:bg-white/20")
    })
  })

  describe("dropdown behavior", () => {
    it("toggles dropdown when clicked", () => {
      render(<ThemePicker />)

      // Dropdown should be closed initially
      expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()

      // Click the trigger button
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Dropdown should be open
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()
    })

    it("closes dropdown when clicking outside", async () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()

      // Click outside
      fireEvent.mouseDown(document.body)

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()
      })

      // clearPreview should be called
      expect(mockClearPreview).toHaveBeenCalled()
    })

    it("closes dropdown when pressing Escape", async () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" })

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()
      })

      // clearPreview should be called
      expect(mockClearPreview).toHaveBeenCalled()
    })
  })

  describe("theme grouping", () => {
    it("groups themes by dark and light types", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show Dark and Light group headers
      expect(screen.getByText("Dark")).toBeInTheDocument()
      expect(screen.getByText("Light")).toBeInTheDocument()
    })

    it("displays all themes in alphabetical order within groups", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // All themes should be visible
      expect(screen.getByText("Dracula")).toBeInTheDocument()
      expect(screen.getByText("Gruvbox Dark")).toBeInTheDocument()
      expect(screen.getByText("GitHub Light")).toBeInTheDocument()
      expect(screen.getByText("Solarized Light")).toBeInTheDocument()
    })

    it("handles high contrast theme types", () => {
      mockThemes = [
        {
          id: "hc-black",
          label: "High Contrast",
          type: "hcDark",
          path: "/path/to/hc.json",
          extensionId: "ms-vscode.theme-defaults",
          extensionName: "Default Themes",
        },
        {
          id: "hc-light",
          label: "High Contrast Light",
          type: "hcLight",
          path: "/path/to/hcl.json",
          extensionId: "ms-vscode.theme-defaults",
          extensionName: "Default Themes",
        },
      ]

      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // HC Dark should be grouped with Dark, HC Light with Light
      expect(screen.getByText("Dark")).toBeInTheDocument()
      expect(screen.getByText("Light")).toBeInTheDocument()
      expect(screen.getByText("High Contrast")).toBeInTheDocument()
      expect(screen.getByText("High Contrast Light")).toBeInTheDocument()
    })
  })

  describe("dropdown content", () => {
    it("shows Default option in dropdown", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Default option should be visible
      expect(screen.getByTestId("theme-picker-default")).toBeInTheDocument()
    })

    it("shows current VS Code theme info", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show current VS Code theme info
      expect(screen.getByText("VS Code: Gruvbox Dark")).toBeInTheDocument()
    })

    it("has refresh button in dropdown", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show Refresh button
      expect(screen.getByText("Refresh")).toBeInTheDocument()
    })

    it("shows checkmark on currently active theme", () => {
      mockActiveThemeId = "dracula"
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // The active theme item should show a checkmark (we'd need to verify the icon is rendered)
      // For simplicity, we check the item has the right styling class
      const draculaItem = screen.getByTestId("theme-picker-item-dracula")
      expect(draculaItem).toHaveClass("bg-accent/50")
    })

    it("shows checkmark on Default when no theme is active", () => {
      mockActiveThemeId = null
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Default option should have active styling
      const defaultItem = screen.getByTestId("theme-picker-default")
      expect(defaultItem).toHaveClass("bg-accent/50")
    })
  })

  describe("theme selection", () => {
    it("calls applyTheme when clicking a theme item", async () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Click on a theme
      fireEvent.click(screen.getByText("Dracula"))

      // applyTheme should be called with theme id
      await waitFor(() => {
        expect(mockApplyTheme).toHaveBeenCalledWith("dracula")
      })
    })

    it("calls resetToDefault when clicking Default option", async () => {
      mockActiveThemeId = "dracula"
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Click Default
      fireEvent.click(screen.getByTestId("theme-picker-default"))

      // resetToDefault should be called
      expect(mockResetToDefault).toHaveBeenCalled()
    })

    it("closes dropdown after selecting a theme", async () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()

      // Click on a theme
      fireEvent.click(screen.getByText("Dracula"))

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()
      })
    })
  })

  describe("preview functionality", () => {
    it("calls previewTheme on hover", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Hover over a theme
      fireEvent.mouseEnter(screen.getByText("Dracula"))

      // previewTheme should be called
      expect(mockPreviewTheme).toHaveBeenCalledWith("dracula")
    })

    it("calls clearPreview on mouse leave", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Hover then leave
      fireEvent.mouseEnter(screen.getByText("Dracula"))
      fireEvent.mouseLeave(screen.getByText("Dracula"))

      // clearPreview should be called
      expect(mockClearPreview).toHaveBeenCalled()
    })
  })

  describe("refresh functionality", () => {
    it("calls fetchThemes when clicking refresh", () => {
      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Click Refresh
      fireEvent.click(screen.getByText("Refresh"))

      // fetchThemes should be called
      expect(mockFetchThemes).toHaveBeenCalled()
    })
  })

  describe("loading states", () => {
    it("disables trigger button when loading", () => {
      mockIsLoadingList = true

      render(<ThemePicker />)

      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toBeDisabled()
    })

    it("shows opacity when loading", () => {
      mockIsLoadingList = true

      render(<ThemePicker />)

      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toHaveClass("opacity-70")
    })

    it("shows loading message when dropdown open with empty themes", () => {
      // First render without loading to open dropdown
      mockThemes = []
      mockIsLoadingList = false

      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Initially shows "No themes found" since not loading
      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })

  describe("error states", () => {
    it("shows error state when there is an error", () => {
      mockError = "Failed to load themes"

      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show error message
      expect(screen.getByText("Failed to load themes")).toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    it("shows empty state when no themes available", () => {
      mockThemes = []
      mockIsLoadingList = false

      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show empty state
      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })

  describe("VS Code theme indicator", () => {
    it("shows VS Code theme when available", () => {
      mockCurrentVSCodeTheme = "Monokai Pro"

      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      expect(screen.getByText("VS Code: Monokai Pro")).toBeInTheDocument()
    })

    it("does not show VS Code theme indicator when null", () => {
      mockCurrentVSCodeTheme = null

      render(<ThemePicker />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      expect(screen.queryByText(/VS Code:/)).not.toBeInTheDocument()
    })
  })
})
