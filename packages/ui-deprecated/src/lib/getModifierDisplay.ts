import { isMac } from "@/lib/isMac"

export function getModifierDisplay(modifier: string): string {
  const mac = isMac()
  switch (modifier) {
    case "cmd":
      return mac ? "⌘" : "Ctrl"
    case "ctrl":
      return mac ? "⌃" : "Ctrl"
    case "alt":
      return mac ? "⌥" : "Alt"
    case "shift":
      return mac ? "⇧" : "Shift"
    default:
      return modifier
  }
}
