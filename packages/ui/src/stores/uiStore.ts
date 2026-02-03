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

  /** Set the sidebar width. */
  setSidebarWidth: (width: number) => void
  /** Toggle the right panel open/closed. */
  toggleRightPanel: () => void
  /** Set the right panel width. */
  setRightPanelWidth: (width: number) => void
  /** Toggle whether tool output is shown. */
  toggleToolOutput: () => void
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

  setSidebarWidth: width => set({ sidebarWidth: width }),
  toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelWidth: width => set({ rightPanelWidth: width }),
  toggleToolOutput: () => set(state => ({ showToolOutput: !state.showToolOutput })),
}))
