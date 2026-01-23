import hotkeysConfig from "./hotkeys.json"

export type HotkeyModifier = "cmd" | "ctrl" | "alt" | "shift"

/** Command palette configuration for a hotkey */
export interface CommandPaletteConfig {
  label: string
  icon: string
  keywords?: string[]
}

export interface HotkeyConfig {
  key: string
  modifiers: HotkeyModifier[]
  description: string
  category: string
  commandPalette?: CommandPaletteConfig
}

/** Raw hotkey entry from JSON file using VS Code format */
interface RawHotkeyConfig {
  key: string // VS Code format like "cmd+shift+t" or just "Enter"
  description: string
  category: string
  commandPalette?: {
    label: string
    icon: string
    keywords?: string[]
  }
}

/**
 * Parse a VS Code-style key binding into key and modifiers.
 * e.g., "cmd+shift+t" -> { key: "t", modifiers: ["cmd", "shift"] }
 */
function parseKeyBinding(keyBinding: string): { key: string; modifiers: HotkeyModifier[] } {
  const parts = keyBinding.split("+")
  const modifiers: HotkeyModifier[] = []
  let key = ""

  for (const part of parts) {
    const lowerPart = part.toLowerCase()
    if (
      lowerPart === "cmd" ||
      lowerPart === "ctrl" ||
      lowerPart === "alt" ||
      lowerPart === "shift"
    ) {
      modifiers.push(lowerPart as HotkeyModifier)
    } else {
      // The last non-modifier part is the key
      key = part
    }
  }

  return { key, modifiers }
}

/**
 * Load hotkeys configuration from JSON and parse VS Code-style key bindings.
 */
function loadHotkeys(): HotkeysConfig {
  const rawHotkeys = hotkeysConfig.hotkeys as Record<string, RawHotkeyConfig>
  const result: Partial<HotkeysConfig> = {}

  for (const [action, config] of Object.entries(rawHotkeys)) {
    const { key, modifiers } = parseKeyBinding(config.key)
    result[action as HotkeyAction] = {
      key,
      modifiers,
      description: config.description,
      category: config.category,
      commandPalette: config.commandPalette,
    }
  }

  return result as HotkeysConfig
}

export const hotkeys: HotkeysConfig = loadHotkeys()

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
