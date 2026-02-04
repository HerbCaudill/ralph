import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ThemePicker } from "../ThemePicker"

// Helper to create standard mock themes
function createMockThemes() {
  return [
    {
      id: "gruvbox-dark",
      label: "Gruvbox Dark",
      type: "dark" as const,
    },
    {
      id: "dracula",
      label: "Dracula",
      type: "dark" as const,
    },
    {
      id: "solarized-light",
      label: "Solarized Light",
      type: "light" as const,
    },
    {
      id: "github-light",
      label: "GitHub Light",
      type: "light" as const,
    },
  ]
}

// Default props for ThemePicker
function createDefaultProps(overrides: Partial<Parameters<typeof ThemePicker>[0]> = {}) {
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

describe("ThemePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders with default display name when no theme is active", () => {
      render(<ThemePicker {...createDefaultProps()} />)
      expect(screen.getByTestId("theme-picker-trigger")).toBeInTheDocument()
      expect(screen.getByText("Default")).toBeInTheDocument()
    })

    it("displays active theme name in trigger when theme is selected", () => {
      render(<ThemePicker {...createDefaultProps({ activeThemeId: "gruvbox-dark" })} />)
      expect(screen.getByText("Gruvbox Dark")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(
        <ThemePicker {...createDefaultProps({ className: "custom-class" })} />,
      )
      expect(container.firstChild).toHaveClass("custom-class")
    })

    it("uses header variant styling when variant is header", () => {
      render(<ThemePicker {...createDefaultProps({ variant: "header", textColor: "#ffffff" })} />)
      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toHaveClass("hover:bg-white/20")
    })
  })

  describe("dropdown behavior", () => {
    it("toggles dropdown when clicked", () => {
      render(<ThemePicker {...createDefaultProps()} />)

      // Dropdown should be closed initially
      expect(screen.queryByTestId("theme-picker-dropdown")).not.toBeInTheDocument()

      // Click the trigger button
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Dropdown should be open
      expect(screen.getByTestId("theme-picker-dropdown")).toBeInTheDocument()
    })

    it("closes dropdown when clicking outside", async () => {
      const props = createDefaultProps()
      render(<ThemePicker {...props} />)

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
      render(<ThemePicker {...props} />)

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
      render(<ThemePicker {...createDefaultProps()} />)

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
    it("shows checkmark on currently active theme", () => {
      render(<ThemePicker {...createDefaultProps({ activeThemeId: "dracula" })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // The active theme item should have the active styling
      const draculaItem = screen.getByTestId("theme-picker-item-dracula")
      expect(draculaItem).toHaveClass("bg-accent/50")
    })
  })

  describe("theme selection", () => {
    it("calls onApplyTheme when clicking a theme item", async () => {
      const props = createDefaultProps()
      render(<ThemePicker {...props} />)

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
      render(<ThemePicker {...props} />)

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

  describe("loading states", () => {
    it("disables trigger button when loading", () => {
      render(<ThemePicker {...createDefaultProps({ isLoading: true })} />)

      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toBeDisabled()
    })

    it("shows opacity when loading", () => {
      render(<ThemePicker {...createDefaultProps({ isLoading: true })} />)

      const trigger = screen.getByTestId("theme-picker-trigger")
      expect(trigger).toHaveClass("opacity-70")
    })

    it("shows loading message when dropdown open with empty themes", () => {
      render(<ThemePicker {...createDefaultProps({ themes: [], isLoading: false })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Initially shows "No themes found" since not loading
      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })

  describe("error states", () => {
    it("shows error state when there is an error and themes exist", () => {
      render(<ThemePicker {...createDefaultProps({ error: "Failed to load themes" })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show error message
      expect(screen.getByText("Failed to load themes")).toBeInTheDocument()
    })

    it("hides theme list when there is an error and themes exist", () => {
      render(<ThemePicker {...createDefaultProps({ error: "Failed to load themes" })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show error message but not the theme items
      expect(screen.getByText("Failed to load themes")).toBeInTheDocument()
      expect(screen.queryByTestId("theme-picker-item-gruvbox-dark")).not.toBeInTheDocument()
      expect(screen.queryByTestId("theme-picker-item-dracula")).not.toBeInTheDocument()
    })

    it("calls onRefresh when clicking retry button in error state", () => {
      const props = createDefaultProps({ error: "Failed to load themes" })
      render(<ThemePicker {...props} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Click the retry button (it's inside the error section)
      const retryButton = screen.getByTitle("Retry")
      fireEvent.click(retryButton)

      // onRefresh should be called
      expect(props.onRefresh).toHaveBeenCalled()
    })

    it("shows 'No themes found' instead of error when there are no themes", () => {
      render(<ThemePicker {...createDefaultProps({ themes: [], error: "Theme not found" })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show "No themes found" instead of the error
      expect(screen.getByText("No themes found")).toBeInTheDocument()
      expect(screen.queryByText("Theme not found")).not.toBeInTheDocument()
    })
  })

  describe("empty states", () => {
    it("shows empty state when no themes available", () => {
      render(<ThemePicker {...createDefaultProps({ themes: [], isLoading: false })} />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("theme-picker-trigger"))

      // Should show empty state
      expect(screen.getByText("No themes found")).toBeInTheDocument()
    })
  })
})
