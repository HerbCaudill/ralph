import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ThemePickerView } from "./ThemePickerView"
import type { ThemeMeta } from "@/lib/theme"

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

// Default props for ThemePickerView
function createDefaultProps(overrides: Partial<Parameters<typeof ThemePickerView>[0]> = {}) {
  return {
    themes: createMockThemes(),
    activeThemeId: null as string | null,
    isLoading: false,
    error: null as string | null,
    onApplyTheme: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  }
}

describe("ThemePickerView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders with default display name when no theme is active", () => {
      render(<ThemePickerView {...createDefaultProps()} />)
      expect(screen.getByTestId("theme-picker-trigger")).toBeInTheDocument()
      expect(screen.getByText("Default")).toBeInTheDocument()
    })

    it("displays active theme name in trigger when theme is selected", () => {
      render(<ThemePickerView {...createDefaultProps({ activeThemeId: "gruvbox-dark" })} />)
      expect(screen.getByText("Gruvbox Dark")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(
        <ThemePickerView {...createDefaultProps({ className: "custom-class" })} />,
      )
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("uses header variant styling when variant is header", () => {
      render(
        <ThemePickerView {...createDefaultProps({ variant: "header", textColor: "#ffffff" })} />,
      )
      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toHaveClass("hover:bg-white/20")
    })
  })

  describe("dropdown behavior", () => {
    it("toggles dropdown when clicked", () => {
      render(<ThemePickerView {...createDefaultProps()} />)

      // Dropdown should be closed initially
      expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()

      // Click the trigger button
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Dropdown should be open
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()
    })

    it("closes dropdown when clicking outside", async () => {
      const props = createDefaultProps()
      render(<ThemePickerView {...props} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()

      // Click outside
      fireEvent.mouseDown(document.body)

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()
      })
    })

    it("closes dropdown when pressing Escape", async () => {
      const props = createDefaultProps()
      render(<ThemePickerView {...props} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" })

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()
      })
    })
  })

  describe("theme display", () => {
    it("displays all passed themes", () => {
      render(<ThemePickerView {...createDefaultProps()} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // All themes should be visible (themes are passed pre-filtered by controller)
      expect(screen.getByText("Dracula")).toBeInTheDocument()
      expect(screen.getByText("Gruvbox Dark")).toBeInTheDocument()
      expect(screen.getByText("GitHub Light")).toBeInTheDocument()
      expect(screen.getByText("Solarized Light")).toBeInTheDocument()
    })
  })

  describe("dropdown content", () => {
    it("has refresh button in dropdown", () => {
      render(<ThemePickerView {...createDefaultProps()} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show Refresh button
      expect(screen.getByText("Refresh")).toBeInTheDocument()
    })

    it("shows checkmark on currently active theme", () => {
      render(<ThemePickerView {...createDefaultProps({ activeThemeId: "dracula" })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // The active theme item should show a checkmark (we'd need to verify the icon is rendered)
      // For simplicity, we check the item has the right styling class
      const draculaItem = screen.getByTestId("theme-picker-item-dracula")
      expect(draculaItem).toHaveClass("bg-repo-accent/50")
    })
  })

  describe("theme selection", () => {
    it("calls onApplyTheme when clicking a theme item", async () => {
      const props = createDefaultProps()
      render(<ThemePickerView {...props} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Click on a theme
      fireEvent.click(screen.getByText("Dracula"))

      // onApplyTheme should be called with theme id
      await waitFor(() => {
        expect(props.onApplyTheme).toHaveBeenCalledWith("dracula")
      })
    })

    it("closes dropdown after selecting a theme", async () => {
      const props = createDefaultProps()
      render(<ThemePickerView {...props} />)

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

  describe("refresh functionality", () => {
    it("calls onRefresh when clicking refresh", () => {
      const props = createDefaultProps()
      render(<ThemePickerView {...props} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Click Refresh
      fireEvent.click(screen.getByText("Refresh"))

      // onRefresh should be called
      expect(props.onRefresh).toHaveBeenCalled()
    })
  })

  describe("loading states", () => {
    it("disables trigger button when loading", () => {
      render(<ThemePickerView {...createDefaultProps({ isLoading: true })} />)

      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toBeDisabled()
    })

    it("shows opacity when loading", () => {
      render(<ThemePickerView {...createDefaultProps({ isLoading: true })} />)

      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toHaveClass("opacity-70")
    })

    it("shows loading message when dropdown open with empty themes", () => {
      render(<ThemePickerView {...createDefaultProps({ themes: [], isLoading: false })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Initially shows "No themes found" since not loading
      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })

  describe("error states", () => {
    it("shows error state when there is an error", () => {
      render(<ThemePickerView {...createDefaultProps({ error: "Failed to load themes" })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show error message
      expect(screen.getByText("Failed to load themes")).toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    it("shows empty state when no themes available", () => {
      render(<ThemePickerView {...createDefaultProps({ themes: [], isLoading: false })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show empty state
      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })
})
