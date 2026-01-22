import hotkeysConfig from "./hotkeys.json"

/**
 * Load hotkeys configuration from JSON.
 */
export const hotkeys: HotkeysConfig = hotkeysConfig.hotkeys as HotkeysConfig

export type HotkeyModifier = "cmd" | "ctrl" | "alt" | "shift"

export interface HotkeyConfig {
  key: string
  modifiers: HotkeyModifier[]
  description: string
  category: string
}

export type HotkeyAction =
  | "agentStart"
  | "agentStop"
  | "agentPause"
  | "agentStopAfterCurrent"
  | "toggleSidebar"
  | "focusSidebar"
  | "focusMain"
  | "focusTaskInput"
  | "focusChatInput"
  | "cycleTheme"
  | "showHotkeys"
  | "toggleInputFocus"
  | "toggleTaskChat"
  | "focusTaskChatInput"
  | "showCommandPalette"
  | "previousIteration"
  | "nextIteration"
  | "latestIteration"
  | "focusSearch"
  | "previousWorkspace"
  | "nextWorkspace"
  | "toggleToolOutput"
  | "newChat"
  | "previousTask"
  | "nextTask"
  | "openTask"

export type HotkeysConfig = Record<HotkeyAction, HotkeyConfig>
