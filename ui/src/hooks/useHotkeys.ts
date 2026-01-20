import { useEffect, useCallback, useRef } from "react"
import { hotkeys, type HotkeyAction, type HotkeyConfig } from "@/config"

// Types

export type HotkeyHandler = () => void

export interface UseHotkeysOptions {
  /** Callback handlers for each hotkey action */
  handlers: Partial<Record<HotkeyAction, HotkeyHandler>>
  /** Whether hotkeys are enabled (default: true) */
  enabled?: boolean
}

export interface UseHotkeysReturn {
  /** Get the display string for a hotkey (e.g., "Cmd+Enter") */
  getHotkeyDisplay: (action: HotkeyAction) => string
  /** All registered hotkeys with their descriptions */
  registeredHotkeys: Array<{ action: HotkeyAction; display: string; description: string }>
}

// Helpers

/**
 * Check if the current platform is macOS
 */
function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

/**
 * Get the display string for a modifier key
 */
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

/**
 * Get the display string for a key
 */
function getKeyDisplay(key: string): string {
  switch (key.toLowerCase()) {
    case "enter":
      return "\u23CE"
    case "escape":
      return "Esc"
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

/**
 * Get the full display string for a hotkey config
 */
function getHotkeyDisplayString(config: HotkeyConfig): string {
  const modifiers = config.modifiers.map(getModifierDisplay)
  const key = getKeyDisplay(config.key)
  return [...modifiers, key].join(isMac() ? "" : "+")
}

/**
 * Check if the event matches the hotkey config
 */
function matchesHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  const mac = isMac()

  // Check modifiers
  const cmdRequired = config.modifiers.includes("cmd")
  const ctrlRequired = config.modifiers.includes("ctrl")
  const altRequired = config.modifiers.includes("alt")
  const shiftRequired = config.modifiers.includes("shift")

  // On Mac, "cmd" maps to metaKey; on Windows/Linux, "cmd" maps to ctrlKey
  const cmdPressed = mac ? event.metaKey : event.ctrlKey
  const ctrlPressed = mac ? event.ctrlKey : false // On non-Mac, ctrl is part of cmd

  // Check if required modifiers are pressed
  if (cmdRequired && !cmdPressed) return false
  if (ctrlRequired && !ctrlPressed) return false
  if (altRequired !== event.altKey) return false
  if (shiftRequired !== event.shiftKey) return false

  // Check if no extra modifiers are pressed
  if (!cmdRequired && cmdPressed) return false
  if (!ctrlRequired && ctrlPressed) return false

  // Check the key
  const eventKey = event.key.toLowerCase()
  const configKey = config.key.toLowerCase()

  return eventKey === configKey
}

/**
 * Check if the event target is an input element
 */
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

// Hook

/**
 * Hook for global keyboard hotkeys.
 *
 * @example
 * ```tsx
 * const { getHotkeyDisplay } = useHotkeys({
 *   handlers: {
 *     agentStart: () => startRalph(),
 *     agentStop: () => stopRalph(),
 *     toggleSidebar: () => setSidebarOpen(!sidebarOpen),
 *   }
 * })
 *
 * // In a tooltip: "Start Ralph ({getHotkeyDisplay('agentStart')})"
 * ```
 */
export function useHotkeys({ handlers, enabled = true }: UseHotkeysOptions): UseHotkeysReturn {
  // Use ref to avoid stale closures
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Don't trigger hotkeys when typing in input fields
      // Exception: Some hotkeys like Cmd+Enter should still work
      const isInput = isInputElement(event.target)

      // Check each hotkey
      for (const [action, config] of Object.entries(hotkeys) as [HotkeyAction, HotkeyConfig][]) {
        if (matchesHotkey(event, config)) {
          const handler = handlersRef.current[action]
          if (handler) {
            // For input elements, only allow certain hotkeys
            // Navigation hotkeys that focus other areas should be allowed
            const allowedInInput = [
              "toggleSidebar",
              "focusSidebar",
              "focusMain",
              "focusTaskInput",
              "focusChatInput",
              "agentStart",
              "agentStop",
              "agentPause",
              "agentStopAfterCurrent",
              "cycleTheme",
              "showHotkeys",
              "toggleInputFocus",
              "toggleTaskChat",
              "focusTaskChatInput",
              "showCommandPalette",
              "previousIteration",
              "nextIteration",
              "latestIteration",
              "focusSearch",
            ]

            if (isInput && !allowedInInput.includes(action)) {
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

  const getHotkeyDisplay = useCallback((action: HotkeyAction): string => {
    const config = hotkeys[action]
    return config ? getHotkeyDisplayString(config) : ""
  }, [])

  const registeredHotkeys = Object.entries(hotkeys).map(([action, config]) => ({
    action: action as HotkeyAction,
    display: getHotkeyDisplayString(config as HotkeyConfig),
    description: (config as HotkeyConfig).description,
  }))

  return {
    getHotkeyDisplay,
    registeredHotkeys,
  }
}
