import { hotkeys, type HotkeyAction } from "@/config"
import { getHotkeyDisplayString } from "@/lib/getHotkeyDisplayString"

export function getShortcut(action: HotkeyAction): string | undefined {
  const config = hotkeys[action]
  return config ? getHotkeyDisplayString(config) : undefined
}
