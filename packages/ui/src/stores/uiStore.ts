import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * UI preferences state for the Ralph UI.
 * Contains layout and display preferences that are not session-specific.
 */
interface UiState {
  /** Width of the sidebar as a percentage of viewport width (0-100). */
  sidebarWidthPercent: number
  /** Whether the right panel is open. */
  rightPanelOpen: boolean
  /** Width of the right panel as a percentage of viewport width (0-100). */
  rightPanelWidthPercent: number
  /** Width of the issue sheet as a percentage of viewport width (0-100). */
  issueSheetWidthPercent: number
  /** Whether to show tool output in the event stream. */
  showToolOutput: boolean
  /** Current theme preference. */
  theme: "system" | "light" | "dark"
  /** Selected VS Code theme ID (null for default). */
  vscodeThemeId: string | null
  /** Last used dark theme ID. */
  lastDarkThemeId: string | null
  /** Last used light theme ID. */
  lastLightThemeId: string | null

  /** Set the sidebar width as a percentage of viewport width. */
  setSidebarWidthPercent: (percent: number) => void
  /** Toggle the right panel open/closed. */
  toggleRightPanel: () => void
  /** Set the right panel width as a percentage of viewport width. */
  setRightPanelWidthPercent: (percent: number) => void
  /** Set the issue sheet width as a percentage of viewport width. */
  setIssueSheetWidthPercent: (percent: number) => void
  /** Toggle whether tool output is shown. */
  toggleToolOutput: () => void
  /** Set the theme preference. */
  setTheme: (theme: "system" | "light" | "dark") => void
  /** Set the VS Code theme ID. */
  setVscodeThemeId: (id: string | null) => void
  /** Set the last used dark theme ID. */
  setLastDarkThemeId: (id: string | null) => void
  /** Set the last used light theme ID. */
  setLastLightThemeId: (id: string | null) => void
}

/** Default sidebar width as percentage of viewport. */
const DEFAULT_SIDEBAR_WIDTH_PERCENT = 20

/** Default right panel width as percentage of viewport. */
const DEFAULT_RIGHT_PANEL_WIDTH_PERCENT = 30

/** Default issue sheet width as percentage of viewport. */
const DEFAULT_ISSUE_SHEET_WIDTH_PERCENT = 25

/**
 * Zustand store for UI preferences.
 * Manages layout state like panel widths and visibility.
 * State is persisted to localStorage.
 */
export const useUiStore = create<UiState>()(
  persist(
    set => ({
      sidebarWidthPercent: DEFAULT_SIDEBAR_WIDTH_PERCENT,
      rightPanelOpen: false,
      rightPanelWidthPercent: DEFAULT_RIGHT_PANEL_WIDTH_PERCENT,
      issueSheetWidthPercent: DEFAULT_ISSUE_SHEET_WIDTH_PERCENT,
      showToolOutput: true,
      theme: "system",
      vscodeThemeId: null,
      lastDarkThemeId: null,
      lastLightThemeId: null,

      setSidebarWidthPercent: percent => set({ sidebarWidthPercent: percent }),
      toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),
      setRightPanelWidthPercent: percent => set({ rightPanelWidthPercent: percent }),
      setIssueSheetWidthPercent: percent => set({ issueSheetWidthPercent: percent }),
      toggleToolOutput: () => set(state => ({ showToolOutput: !state.showToolOutput })),
      setTheme: theme => set({ theme }),
      setVscodeThemeId: id => set({ vscodeThemeId: id }),
      setLastDarkThemeId: id => set({ lastDarkThemeId: id }),
      setLastLightThemeId: id => set({ lastLightThemeId: id }),
    }),
    {
      name: "ralph-ui-preferences",
      version: 1,
    },
  ),
)

/**
 * Select the current theme preference.
 */
export const selectTheme = (state: UiState) => state.theme

/**
 * Select the VS Code theme ID.
 */
export const selectVscodeThemeId = (state: UiState) => state.vscodeThemeId

/**
 * Select the last used dark theme ID.
 */
export const selectLastDarkThemeId = (state: UiState) => state.lastDarkThemeId

/**
 * Select the last used light theme ID.
 */
export const selectLastLightThemeId = (state: UiState) => state.lastLightThemeId
