import { render, screen, fireEvent, waitFor, act } from "@/test-utils"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { MainLayout } from ".././MainLayout"
import { useAppStore } from "@/store"

// Mock the hooks used by theme components (ThemePicker, SettingsDropdown)
vi.mock("@/hooks", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
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
    useThemeCoordinator: () => ({
      // VS Code theme values
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
      // Light/dark theme values
      theme: "system",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
      setMode: vi.fn(),
      cycleTheme: vi.fn(),
    }),
  }
})

// Mock fetch for WorkspacePicker
const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

// Mock matchMedia for theme detection
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the store before each test
    useAppStore.getState().reset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          workspace: {
            path: "/test/workspace",
            name: "workspace",
            issueCount: 10,
            daemonConnected: true,
          },
        }),
    })
    // Mock matchMedia for theme detection
    window.matchMedia = mockMatchMedia
    // Mock window.innerWidth for percentage-to-pixel conversions
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders sidebar content", async () => {
    render(<MainLayout sidebar={<div>Sidebar Content</div>} />)
    expect(screen.getByText("Sidebar Content")).toBeInTheDocument()

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("workspace")).toBeInTheDocument()
    })
  })

  it("renders main content", async () => {
    render(<MainLayout main={<div>Main Content</div>} />)
    expect(screen.getByText("Main Content")).toBeInTheDocument()

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("workspace")).toBeInTheDocument()
    })
  })

  it("renders status bar when provided", async () => {
    render(<MainLayout statusBar={<div>Status Bar Content</div>} />)
    expect(screen.getByText("Status Bar Content")).toBeInTheDocument()

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("workspace")).toBeInTheDocument()
    })
  })

  it("does not render status bar when not provided", async () => {
    const { container } = render(<MainLayout />)
    expect(container.querySelector("footer")).not.toBeInTheDocument()

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("workspace")).toBeInTheDocument()
    })
  })

  it("applies custom className", async () => {
    const { container } = render(<MainLayout className="custom-class" />)
    expect(container.firstChild).toHaveClass("custom-class")

    // Wait for workspace fetch to complete to avoid act() warning
    await waitFor(() => {
      expect(screen.getByText("workspace")).toBeInTheDocument()
    })
  })

  describe("accent color border", () => {
    it("renders with default accent color border when no accent color is set", async () => {
      const { container } = render(<MainLayout />)
      const layoutDiv = container.firstChild as HTMLElement
      // Check border style is applied (jsdom converts hex to rgb)
      expect(layoutDiv.style.border).toBe("6px solid rgb(55, 65, 81)")

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("renders with accent color border from store", async () => {
      // Set accent color in store
      act(() => {
        useAppStore.getState().setAccentColor("#ff5500")
      })

      const { container } = render(<MainLayout />)
      const layoutDiv = container.firstChild as HTMLElement
      // Check border style is applied (jsdom converts hex to rgb)
      expect(layoutDiv.style.border).toBe("6px solid rgb(255, 85, 0)")

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })
  })

  describe("resizable sidebar", () => {
    it("renders resize handle when sidebar is open", async () => {
      render(<MainLayout sidebar={<div>Sidebar Content</div>} />)
      expect(screen.getByRole("separator", { name: /resize sidebar/i })).toBeInTheDocument()

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("updates sidebar width on drag", async () => {
      render(<MainLayout sidebar={<div>Sidebar Content</div>} />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse to simulate resize (400px on 1024px window = ~39%)
      fireEvent.mouseMove(document, { clientX: 400 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Check that the store was updated with percentage (400/1024 * 100 ≈ 39.0625%)
      expect(useAppStore.getState().sidebarWidth).toBeCloseTo(39.0625, 1)
    })

    it("respects minimum sidebar width", async () => {
      render(<MainLayout sidebar={<div>Sidebar Content</div>} />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse below minimum (100px, but min is 200px)
      fireEvent.mouseMove(document, { clientX: 100 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Should be clamped to minimum (200px on 1024px window = ~19.53%)
      expect(useAppStore.getState().sidebarWidth).toBeCloseTo(19.53, 1)
    })

    it("respects maximum sidebar width", async () => {
      render(<MainLayout sidebar={<div>Sidebar Content</div>} />)

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse above maximum (800px, but max is 600px)
      fireEvent.mouseMove(document, { clientX: 800 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Should be clamped to maximum (600px on 1024px window = ~58.59%)
      expect(useAppStore.getState().sidebarWidth).toBeCloseTo(58.59, 1)
    })

    it("applies width from store to sidebar", async () => {
      // Set a custom width as percentage (35% of window width)
      useAppStore.getState().setSidebarWidth(35)

      render(<MainLayout sidebar={<div>Sidebar Content</div>} />)

      const sidebar = screen.getByText("Sidebar Content").closest("aside")
      // 35% of 1024px = 358px (rounded)
      expect(sidebar).toHaveStyle({ width: "358px" })

      // Wait for workspace fetch to complete to avoid act() warning
      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })
  })

  describe("right panel", () => {
    it("renders right panel content when open", async () => {
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={40} // 40% of window width
        />,
      )
      expect(screen.getByText("Right Panel Content")).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("does not render right panel content when closed", async () => {
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={false}
          rightPanelWidth={40} // 40% of window width
        />,
      )
      expect(screen.queryByText("Right Panel Content")).not.toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("has zero width when closed", async () => {
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={false}
          rightPanelWidth={40} // 40% of window width
        />,
      )

      const rightPanel = screen.getByTestId("right-panel")
      expect(rightPanel).toHaveStyle({ width: "0px" })

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("applies custom width when open", async () => {
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={50} // 50% of window width
        />,
      )

      const rightPanel = screen.getByTestId("right-panel")
      // 50% of 1024px = 512px
      expect(rightPanel).toHaveStyle({ width: "512px" })

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("renders resize handle when open with onRightPanelWidthChange", async () => {
      const onWidthChange = vi.fn()
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={40} // 40% of window width
          onRightPanelWidthChange={onWidthChange}
        />,
      )
      expect(screen.getByRole("separator", { name: /resize right panel/i })).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("does not render resize handle when onRightPanelWidthChange is not provided", async () => {
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={40} // 40% of window width
        />,
      )
      expect(
        screen.queryByRole("separator", { name: /resize right panel/i }),
      ).not.toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("does not render resize handle when panel is closed", async () => {
      const onWidthChange = vi.fn()
      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={false}
          rightPanelWidth={40} // 40% of window width
          onRightPanelWidthChange={onWidthChange}
        />,
      )
      expect(
        screen.queryByRole("separator", { name: /resize right panel/i }),
      ).not.toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("calls onRightPanelWidthChange on drag", async () => {
      const onWidthChange = vi.fn()

      // Mock window.innerWidth
      Object.defineProperty(window, "innerWidth", {
        value: 1200,
        writable: true,
        configurable: true,
      })

      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={40} // 40% of window width
          onRightPanelWidthChange={onWidthChange}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      const resizeHandle = screen.getByRole("separator", { name: /resize right panel/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse to simulate resize (window width 1200, clientX 700 = panel width 500px)
      fireEvent.mouseMove(document, { clientX: 700 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Check that the callback was called with percentage (500/1200 * 100 ≈ 41.67%)
      expect(onWidthChange).toHaveBeenCalledWith(expect.closeTo(41.67, 1))
    })

    it("respects minimum right panel width", async () => {
      const onWidthChange = vi.fn()

      // Mock window.innerWidth
      Object.defineProperty(window, "innerWidth", {
        value: 1200,
        writable: true,
        configurable: true,
      })

      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={40} // 40% of window width
          onRightPanelWidthChange={onWidthChange}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      const resizeHandle = screen.getByRole("separator", { name: /resize right panel/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse to make panel too small (window 1200, clientX 1100 = panel would be 100px)
      fireEvent.mouseMove(document, { clientX: 1100 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Should be clamped to minimum (300px on 1200px window = 25%)
      expect(onWidthChange).toHaveBeenCalledWith(25)
    })

    it("respects maximum right panel width", async () => {
      const onWidthChange = vi.fn()

      // Mock window.innerWidth
      Object.defineProperty(window, "innerWidth", {
        value: 1200,
        writable: true,
        configurable: true,
      })

      render(
        <MainLayout
          rightPanel={<div>Right Panel Content</div>}
          rightPanelOpen={true}
          rightPanelWidth={40} // 40% of window width
          onRightPanelWidthChange={onWidthChange}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      const resizeHandle = screen.getByRole("separator", { name: /resize right panel/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse to make panel too large (window 1200, clientX 100 = panel would be 1100px)
      fireEvent.mouseMove(document, { clientX: 100 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Should be clamped to maximum (800px on 1200px window = ~66.67%)
      expect(onWidthChange).toHaveBeenCalledWith(expect.closeTo(66.67, 1))
    })

    it("defaults to closed state when rightPanelOpen is not provided", async () => {
      render(<MainLayout rightPanel={<div>Right Panel Content</div>} rightPanelWidth={40} />)

      expect(screen.queryByText("Right Panel Content")).not.toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("defaults to 25% width when rightPanelWidth is not provided", async () => {
      render(<MainLayout rightPanel={<div>Right Panel Content</div>} rightPanelOpen={true} />)

      const rightPanel = screen.getByTestId("right-panel")
      // Default is 25%, which is 256px on 1024px window
      expect(rightPanel).toHaveStyle({ width: "256px" })

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })
  })

  describe("detail panel", () => {
    it("renders detail panel content when open", async () => {
      render(<MainLayout detailPanel={<div>Detail Panel Content</div>} detailPanelOpen={true} />)
      expect(screen.getByText("Detail Panel Content")).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("does not render detail panel content when closed", async () => {
      render(<MainLayout detailPanel={<div>Detail Panel Content</div>} detailPanelOpen={false} />)
      expect(screen.queryByText("Detail Panel Content")).not.toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })
    })

    it("calls onDetailPanelClose when clicking outside the detail panel", async () => {
      const onDetailPanelClose = vi.fn()

      render(
        <MainLayout
          main={<div>Main Content</div>}
          detailPanel={<div>Detail Panel Content</div>}
          detailPanelOpen={true}
          onDetailPanelClose={onDetailPanelClose}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      // Wait for the event listener to be attached (100ms delay in implementation)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      // Click on the main content (outside the detail panel)
      const mainContent = screen.getByText("Main Content")
      fireEvent.mouseDown(mainContent)

      // The callback should be called
      expect(onDetailPanelClose).toHaveBeenCalledTimes(1)
    })

    it("does not call onDetailPanelClose when clicking inside the detail panel", async () => {
      const onDetailPanelClose = vi.fn()

      render(
        <MainLayout
          main={<div>Main Content</div>}
          detailPanel={<div>Detail Panel Content</div>}
          detailPanelOpen={true}
          onDetailPanelClose={onDetailPanelClose}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      // Wait for the event listener to be attached (100ms delay in implementation)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      // Click inside the detail panel
      const detailContent = screen.getByText("Detail Panel Content")
      fireEvent.mouseDown(detailContent)

      // The callback should NOT be called
      expect(onDetailPanelClose).not.toHaveBeenCalled()
    })

    it("does not attach click listener when panel is closed", async () => {
      const onDetailPanelClose = vi.fn()

      render(
        <MainLayout
          main={<div>Main Content</div>}
          detailPanel={<div>Detail Panel Content</div>}
          detailPanelOpen={false}
          onDetailPanelClose={onDetailPanelClose}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      // Wait for potential event listener attachment
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      // Click on the main content
      const mainContent = screen.getByText("Main Content")
      fireEvent.mouseDown(mainContent)

      // The callback should NOT be called since panel is closed
      expect(onDetailPanelClose).not.toHaveBeenCalled()
    })

    it("does not attach click listener when onDetailPanelClose is not provided", async () => {
      render(
        <MainLayout
          main={<div>Main Content</div>}
          detailPanel={<div>Detail Panel Content</div>}
          detailPanelOpen={true}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      // Wait for potential event listener attachment
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      // Click on the main content - should not throw
      const mainContent = screen.getByText("Main Content")
      expect(() => fireEvent.mouseDown(mainContent)).not.toThrow()
    })

    it("does not call onDetailPanelClose when clicking inside a Radix portal", async () => {
      const onDetailPanelClose = vi.fn()

      // Create a mock Radix portal element outside the detail panel
      const portalElement = document.createElement("div")
      portalElement.setAttribute("data-radix-popper-content-wrapper", "")
      portalElement.innerHTML = "<div>Portal Content</div>"
      document.body.appendChild(portalElement)

      render(
        <MainLayout
          main={<div>Main Content</div>}
          detailPanel={<div>Detail Panel Content</div>}
          detailPanelOpen={true}
          onDetailPanelClose={onDetailPanelClose}
        />,
      )

      await waitFor(() => {
        expect(screen.getByText("workspace")).toBeInTheDocument()
      })

      // Wait for the event listener to be attached (100ms delay in implementation)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      // Click inside the portal element (simulating a dropdown click)
      const portalContent = portalElement.querySelector("div")!
      fireEvent.mouseDown(portalContent)

      // The callback should NOT be called
      expect(onDetailPanelClose).not.toHaveBeenCalled()

      // Cleanup
      document.body.removeChild(portalElement)
    })
  })
})
