import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SettingsDropdown } from "../SettingsDropdown"

// Mock the hooks
vi.mock("@/hooks/useThemes", () => ({
  useThemes: () => ({
    themes: [
      { id: "one-dark", label: "One Dark", type: "dark" as const },
      { id: "solarized-light", label: "Solarized Light", type: "light" as const },
    ],
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock("@/hooks/useApplyTheme", () => ({
  useApplyTheme: () => ({
    applyTheme: vi.fn(),
    changeMode: vi.fn(),
    resolvedTheme: "dark",
  }),
}))

vi.mock("@/stores/uiStore", () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      theme: "system",
      vscodeThemeId: "one-dark",
    }),
  selectTheme: (state: Record<string, unknown>) => state.theme,
  selectVscodeThemeId: (state: Record<string, unknown>) => state.vscodeThemeId,
}))

describe("SettingsDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses text-popover-foreground on the dropdown container for readability", () => {
    render(<SettingsDropdown />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

    const dropdown = screen.getByTestId("settings-dropdown")
    expect(dropdown).toHaveClass("text-popover-foreground")
  })

  it("uses a readable color for the active theme checkmark, not text-primary", () => {
    render(<SettingsDropdown />)

    // Open dropdown
    fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

    // The active theme item should have a checkmark that doesn't use text-primary
    // (text-primary is white on white in light mode)
    const activeItem = screen.getByTestId("settings-theme-item-one-dark")
    const checkmark = activeItem.querySelector("svg")
    expect(checkmark).not.toBeNull()
    expect(checkmark!.getAttribute("class")).not.toContain("text-primary")
  })
})
