import { render, screen } from "@/test-utils"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { Header } from "./Header"
import { useAppStore } from "@/store"

// Mock the hooks used by child components (WorkspacePicker, SettingsDropdown)
vi.mock("@/hooks", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const { useAppStore, selectTheme } = await import("@/store")
  return {
    ...actual,
    useVSCodeTheme: () => ({
      themes: [],
      activeTheme: null,
      activeThemeId: null,
      currentVSCodeTheme: null,
      variant: null,
      isLoadingList: false,
      isLoadingTheme: false,
      error: null,
      fetchThemes: vi.fn(),
      applyTheme: vi.fn(),
      previewTheme: vi.fn(),
      clearPreview: vi.fn(),
      resetToDefault: vi.fn(),
    }),
    useThemeCoordinator: () => {
      const theme = useAppStore(selectTheme)
      const resolvedTheme = theme === "system" ? "dark" : theme
      return {
        themes: [],
        activeTheme: null,
        activeThemeId: null,
        currentVSCodeTheme: null,
        variant: null,
        isLoadingList: false,
        isLoadingTheme: false,
        error: null,
        fetchThemes: vi.fn(),
        applyTheme: vi.fn(),
        previewTheme: vi.fn(),
        clearPreview: vi.fn(),
        resetToDefault: vi.fn(),
        theme,
        resolvedTheme,
        setTheme: vi.fn(),
        setMode: vi.fn(),
        cycleTheme: vi.fn(),
      }
    },
  }
})

// Mock fetch for child components that may use it
const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

describe("Header", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, workspace: null }),
    })
  })

  describe("rendering", () => {
    it("renders logo", () => {
      render(<Header accentColor="#007ACC" instanceCount={1} />)
      expect(screen.getByText("Ralph")).toBeInTheDocument()
    })

    it("renders settings dropdown trigger", () => {
      render(<Header accentColor="#007ACC" instanceCount={1} />)
      expect(screen.getByTestId("settings-dropdown-trigger")).toBeInTheDocument()
    })

    it("renders help button", () => {
      render(<Header accentColor="#007ACC" instanceCount={1} />)
      expect(screen.getByTestId("help-button")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(
        <Header accentColor="#007ACC" instanceCount={1} className="custom-class" />,
      )
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("accent color background", () => {
    it("uses provided accent color as background", () => {
      render(<Header accentColor="#42B883" instanceCount={1} />)
      const header = screen.getByTestId("header")
      expect(header).toHaveStyle({ backgroundColor: "#42B883" })
    })

    it("uses default accent color when accentColor is null", () => {
      render(<Header accentColor={null} instanceCount={1} />)
      const header = screen.getByTestId("header")
      // Default accent color is #374151 (neutral gray)
      expect(header).toHaveStyle({ backgroundColor: "#374151" })
    })

    it("applies different colors correctly", () => {
      const { rerender } = render(<Header accentColor="#FF5733" instanceCount={1} />)
      expect(screen.getByTestId("header")).toHaveStyle({ backgroundColor: "#FF5733" })

      rerender(<Header accentColor="#9B59B6" instanceCount={1} />)
      expect(screen.getByTestId("header")).toHaveStyle({ backgroundColor: "#9B59B6" })
    })
  })

  describe("instance count badge", () => {
    it("does not show badge when instanceCount is 1", () => {
      render(<Header accentColor="#007ACC" instanceCount={1} />)
      expect(screen.queryByTestId("instance-count-badge")).not.toBeInTheDocument()
    })

    it("shows badge when instanceCount is greater than 1", () => {
      render(<Header accentColor="#007ACC" instanceCount={2} />)
      const badge = screen.getByTestId("instance-count-badge")
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent("2")
    })

    it("shows correct count for multiple instances", () => {
      render(<Header accentColor="#007ACC" instanceCount={5} />)
      const badge = screen.getByTestId("instance-count-badge")
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent("5")
    })
  })
})
