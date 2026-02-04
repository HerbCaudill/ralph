import { create } from "zustand"

/**
 * UI preferences state for the Ralph UI.
 * Contains layout and display preferences that are not session-specific.
 */
interface UiState {
  /** Width of the sidebar in pixels. */
  sidebarWidth: number
  /** Whether the right panel is open. */
  rightPanelOpen: boolean
  /** Width of the right panel in pixels. */
  rightPanelWidth: number
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

  /** Set the sidebar width. */
  setSidebarWidth: (width: number) => void
  /** Toggle the right panel open/closed. */
  toggleRightPanel: () => void
  /** Set the right panel width. */
  setRightPanelWidth: (width: number) => void
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

/**
 * Zustand store for UI preferences.
 * Manages layout state like panel widths and visibility.
 */
export const useUiStore = create<UiState>()(set => ({
  sidebarWidth: 280,
  rightPanelOpen: false,
  rightPanelWidth: 400,
  showToolOutput: true,
  theme: "system",
  vscodeThemeId: null,
  lastDarkThemeId: null,
  lastLightThemeId: null,

  setSidebarWidth: width => set({ sidebarWidth: width }),
  toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelWidth: width => set({ rightPanelWidth: width }),
  toggleToolOutput: () => set(state => ({ showToolOutput: !state.showToolOutput })),
  setTheme: theme => set({ theme }),
  setVscodeThemeId: id => set({ vscodeThemeId: id }),
  setLastDarkThemeId: id => set({ lastDarkThemeId: id }),
  setLastLightThemeId: id => set({ lastLightThemeId: id }),
}))

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
