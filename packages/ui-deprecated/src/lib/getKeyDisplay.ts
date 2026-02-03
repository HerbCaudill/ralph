export function getKeyDisplay(key: string): string {
  switch (key.toLowerCase()) {
    case "enter":
      return "⏎"
    case "escape":
      return "Esc"
    case "backspace":
      return "⌫"
    case "arrowup":
      return "↑"
    case "arrowdown":
      return "↓"
    case "arrowleft":
      return "←"
    case "arrowright":
      return "→"
    default:
      return key.toUpperCase()
  }
}
