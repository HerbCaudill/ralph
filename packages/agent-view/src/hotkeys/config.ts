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
function loadHotkeys(): AgentHotkeysConfig {
  const rawHotkeys = hotkeysConfig.hotkeys as Record<string, RawHotkeyConfig>
  const result: Partial<AgentHotkeysConfig> = {}

  for (const [action, config] of Object.entries(rawHotkeys)) {
    const { key, modifiers } = parseKeyBinding(config.key)
    result[action as AgentHotkeyAction] = {
      key,
      modifiers,
      description: config.description,
      category: config.category,
    }
  }

  return result as AgentHotkeysConfig
}

/** All available agent-view hotkey actions */
export type AgentHotkeyAction =
  | "focusChatInput"
  | "newSession"
  | "toggleToolOutput"
  | "scrollToBottom"
  | "showHotkeys"
  | "startRalph"

export type AgentHotkeysConfig = Record<AgentHotkeyAction, HotkeyConfig>

/** The parsed hotkey configuration for all agent-view actions */
export const hotkeys: AgentHotkeysConfig = loadHotkeys()
