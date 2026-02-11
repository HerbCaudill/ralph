import hotkeysConfig from "./hotkeys.json"

export type HotkeyModifier = "cmd" | "ctrl" | "alt" | "shift"

export interface HotkeyConfig {
  key: string
  modifiers: HotkeyModifier[]
  description: string
  category: string
}

/** Raw hotkey entry from JSON file using VS Code format */
interface RawHotkeyConfig {
  key: string // VS Code format like "cmd+shift+t" or just "Enter"
  description: string
  category: string
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
      key = part
    }
  }

  return { key, modifiers }
}

/** Load hotkeys configuration from JSON and parse VS Code-style key bindings. */
function loadHotkeys(): HotkeysConfig {
  const rawHotkeys = hotkeysConfig.hotkeys as Record<string, RawHotkeyConfig>
  const result: Partial<HotkeysConfig> = {}

  for (const [action, config] of Object.entries(rawHotkeys)) {
    const { key, modifiers } = parseKeyBinding(config.key)
    result[action as BeadsHotkeyAction] = {
      key,
      modifiers,
      description: config.description,
      category: config.category,
    }
  }

  return result as HotkeysConfig
}

/** All available beads-view hotkey actions */
export type BeadsHotkeyAction =
  | "focusSearch"
  | "previousTask"
  | "nextTask"
  | "openTask"
  | "showHotkeys"
  | "previousWorkspace"
  | "nextWorkspace"

export type HotkeysConfig = Record<BeadsHotkeyAction, HotkeyConfig>

/** The parsed hotkey configuration for all beads-view actions */
export const hotkeys: HotkeysConfig = loadHotkeys()
