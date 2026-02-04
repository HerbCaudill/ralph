import type { HotkeyConfig } from "@/config"
import { getKeyDisplay } from "@/lib/getKeyDisplay"
import { getModifierDisplay } from "@/lib/getModifierDisplay"
import { isMac } from "@/lib/isMac"

export function getHotkeyDisplayString(config: HotkeyConfig): string {
  const modifiers = config.modifiers.map(getModifierDisplay)
  const key = getKeyDisplay(config.key)
  return [...modifiers, key].join(isMac() ? "" : "+")
}
