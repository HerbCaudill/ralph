/**
 * Tests for SettingsDropdown component, focused on text visibility in light mode.
 */

import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SettingsDropdown } from "../SettingsDropdown"

// Mock the hooks used by SettingsDropdown
vi.mock("@/hooks/useThemes", () => ({
  useThemes: () => ({
    themes: [
      { id: "github-light", label: "GitHub Light", type: "light" },
      { id: "dracula", label: "Dracula", type: "dark" },
    ],
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock("@/hooks/useApplyTheme", () => ({
  useApplyTheme: () => ({
    applyTheme: vi.fn(),
    changeMode: vi.fn(),
    resolvedTheme: "light",
  }),
}))

vi.mock("@/stores/uiStore", () => ({
  useUiStore: (selector: (state: any) => any) =>
    selector({
      theme: "light",
      vscodeThemeId: "github-light",
    }),
  selectTheme: (state: any) => state.theme,
  selectVscodeThemeId: (state: any) => state.vscodeThemeId,
}))

describe("SettingsDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("text visibility in light mode", () => {
    it("dropdown container has text-popover-foreground for readable text", () => {
      render(<SettingsDropdown />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      const dropdown = screen.getByTestId("settings-dropdown")
      expect(dropdown).toHaveClass("text-popover-foreground")
    })

    it("checkmark icon uses text-accent-foreground instead of text-primary", () => {
      render(<SettingsDropdown />)

      // Open dropdown
      fireEvent.click(screen.getByTestId("settings-dropdown-trigger"))

      // Active theme should show a checkmark — it should use text-accent-foreground
      // (which is readable against the popover), not text-primary (which is the
      // accent color itself and could clash with the background)
      const activeThemeItem = screen.getByTestId("settings-theme-item-github-light")
      const checkIcon = activeThemeItem.querySelector("svg")
      expect(checkIcon).toBeTruthy()
      const classes = checkIcon!.getAttribute("class") ?? ""
      expect(classes).toContain("text-accent-foreground")
      expect(classes).not.toContain("text-primary")
    })
  })
})
