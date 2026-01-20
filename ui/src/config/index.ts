import hotkeysConfig from "./hotkeys.json"

// Types

export type HotkeyModifier = "cmd" | "ctrl" | "alt" | "shift"

export interface HotkeyConfig {
  key: string
  modifiers: HotkeyModifier[]
  description: string
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

export type HotkeysConfig = Record<HotkeyAction, HotkeyConfig>

// Config

export const hotkeys: HotkeysConfig = hotkeysConfig.hotkeys as HotkeysConfig
