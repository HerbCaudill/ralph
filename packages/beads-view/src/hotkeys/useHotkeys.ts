import { useEffect, useCallback, useRef } from "react"
import { hotkeys, type BeadsHotkeyAction, type HotkeyConfig } from "./config"

export type HotkeyHandler = () => void

export interface UseBeadsHotkeysOptions {
  /** Callback handlers for each hotkey action */
  handlers: Partial<Record<BeadsHotkeyAction, HotkeyHandler>>
  /** Whether hotkeys are enabled (default: true) */
  enabled?: boolean
}

export interface UseBeadsHotkeysReturn {
  /** Get the display string for a hotkey (e.g., "⌘F") */
  getHotkeyDisplay: (action: BeadsHotkeyAction) => string
  /** All registered hotkeys with their descriptions */
  registeredHotkeys: Array<{ action: BeadsHotkeyAction; display: string; description: string }>
}

/** Check if the current platform is macOS */
function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

/** Get the display string for a modifier key */
function getModifierDisplay(modifier: string): string {
  const mac = isMac()
  switch (modifier) {
    case "cmd":
      return mac ? "\u2318" : "Ctrl"
    case "ctrl":
      return mac ? "\u2303" : "Ctrl"
    case "alt":
      return mac ? "\u2325" : "Alt"
    case "shift":
      return mac ? "\u21E7" : "Shift"
    default:
      return modifier
  }
}

/** Get the display string for a key */
function getKeyDisplay(key: string): string {
  switch (key.toLowerCase()) {
    case "enter":
      return "\u23CE"
    case "escape":
      return "Esc"
    case "backspace":
      return "\u232B"
    case "arrowup":
      return "\u2191"
    case "arrowdown":
      return "\u2193"
    case "arrowleft":
      return "\u2190"
    case "arrowright":
      return "\u2192"
    default:
      return key.toUpperCase()
  }
}

/** Get the full display string for a hotkey config */
export function getHotkeyDisplayString(config: HotkeyConfig): string {
  const modifiers = config.modifiers.map(getModifierDisplay)
  const key = getKeyDisplay(config.key)
  return [...modifiers, key].join(isMac() ? "" : "+")
}

/** Check if the event matches the hotkey config */
function matchesHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  const mac = isMac()

  const cmdRequired = config.modifiers.includes("cmd")
  const ctrlRequired = config.modifiers.includes("ctrl")
  const altRequired = config.modifiers.includes("alt")
  const shiftRequired = config.modifiers.includes("shift")

  // On Mac, "cmd" maps to metaKey; on Windows/Linux, "cmd" maps to ctrlKey
  const cmdPressed = mac ? event.metaKey : event.ctrlKey
  const ctrlPressed = event.ctrlKey

  if (cmdRequired && !cmdPressed) return false
  if (ctrlRequired && !ctrlPressed) return false
  if (altRequired !== event.altKey) return false
  if (shiftRequired !== event.shiftKey) return false

  // Check if no extra modifiers are pressed
  // On Mac, cmd (metaKey) and ctrl (ctrlKey) are separate physical keys
  // On non-Mac, cmd maps to ctrlKey, so cmd and ctrl share the same physical key
  // This means: on non-Mac, if either cmd or ctrl is required, pressing ctrlKey is expected
  if (mac) {
    if (!cmdRequired && cmdPressed) return false
    if (!ctrlRequired && ctrlPressed) return false
  } else {
    // On non-Mac, both cmdPressed and ctrlPressed come from event.ctrlKey
    // Only reject if ctrl is pressed but neither cmd nor ctrl is required
    if (!cmdRequired && !ctrlRequired && ctrlPressed) return false
  }

  const eventKey = event.key.toLowerCase()
  const configKey = config.key.toLowerCase()

  return eventKey === configKey
}

/** Check if the event target is an input element */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    (target as HTMLElement).isContentEditable
  )
}

/** Actions that should still work when focused on an input element */
const ALLOWED_IN_INPUT: BeadsHotkeyAction[] = ["focusSearch", "showHotkeys"]

/**
 * Hook for global keyboard hotkeys in beads-view.
 *
 * Registers keyboard event listeners and invokes the appropriate handler
 * when a matching hotkey is pressed. Platform-aware (macOS vs Windows/Linux).
 *
 * @example
 * ```tsx
 * const { getHotkeyDisplay } = useBeadsHotkeys({
 *   handlers: {
 *     focusSearch: () => searchRef.current?.focus(),
 *     previousTask: () => selectPrevious(),
 *     nextTask: () => selectNext(),
 *     openTask: () => openSelected(),
 *   }
 * })
 *
 * // In a tooltip: `Search (${getHotkeyDisplay('focusSearch')})`
 * ```
 */
export function useBeadsHotkeys({
  handlers,
  enabled = true,
}: UseBeadsHotkeysOptions): UseBeadsHotkeysReturn {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      const isInput = isInputElement(event.target)

      for (const [action, config] of Object.entries(hotkeys) as [
        BeadsHotkeyAction,
        HotkeyConfig,
      ][]) {
        if (matchesHotkey(event, config)) {
          const handler = handlersRef.current[action]
          if (handler) {
            if (isInput && !ALLOWED_IN_INPUT.includes(action)) {
              return
            }

            event.preventDefault()
            event.stopPropagation()
            handler()
            return
          }
        }
      }
    },
    [enabled],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [handleKeyDown])

  const getHotkeyDisplay = useCallback((action: BeadsHotkeyAction): string => {
    const config = hotkeys[action]
    return config ? getHotkeyDisplayString(config) : ""
  }, [])

  const registeredHotkeys = Object.entries(hotkeys).map(([action, config]) => ({
    action: action as BeadsHotkeyAction,
    display: getHotkeyDisplayString(config as HotkeyConfig),
    description: (config as HotkeyConfig).description,
  }))

  return {
    getHotkeyDisplay,
    registeredHotkeys,
  }
}
