import { useMemo } from "react"
import { IconKeyboard } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { hotkeys, type HotkeyAction, type HotkeyConfig } from "@/config"

// Types

export interface HotkeysDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the dialog should close */
  onClose: () => void
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

// Hotkey categories for better organization
interface HotkeyCategory {
  name: string
  actions: HotkeyAction[]
}

const hotkeyCategories: HotkeyCategory[] = [
  {
    name: "Agent Control",
    actions: ["agentStart", "agentStop", "agentPause", "agentStopAfterCurrent"],
  },
  {
    name: "Navigation",
    actions: [
      "toggleSidebar",
      "focusSidebar",
      "focusMain",
      "focusTaskInput",
      "focusChatInput",
      "toggleTaskChat",
      "focusTaskChatInput",
    ],
  },
  {
    name: "Appearance",
    actions: ["cycleTheme"],
  },
  {
    name: "Help",
    actions: ["showCommandPalette", "showHotkeys"],
  },
]

// HotkeyRow Component

interface HotkeyRowProps {
  action: HotkeyAction
  config: HotkeyConfig
}

function HotkeyRow({ config }: HotkeyRowProps) {
  const display = getHotkeyDisplayString(config)

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-foreground text-sm">{config.description}</span>
      <kbd className="bg-muted text-muted-foreground border-border ml-4 shrink-0 rounded border px-2 py-1 font-mono text-xs">
        {display}
      </kbd>
    </div>
  )
}

// HotkeysDialog Component

/**
 * Dialog showing all available keyboard shortcuts.
 * Organized by category for easy reference.
 */
export function HotkeysDialog({ open, onClose }: HotkeysDialogProps) {
  // Build the hotkey list grouped by category
  const groupedHotkeys = useMemo(() => {
    return hotkeyCategories.map(category => ({
      ...category,
      hotkeys: category.actions
        .filter(action => hotkeys[action])
        .map(action => ({
          action,
          config: hotkeys[action],
        })),
    }))
  }, [])

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconKeyboard className="text-muted-foreground h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of keyboard shortcuts available in the application
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-6 overflow-y-auto py-2">
          {groupedHotkeys.map(category => (
            <div key={category.name}>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {category.name}
              </h3>
              <div className="border-border divide-border divide-y rounded-md border">
                {category.hotkeys.map(({ action, config }) => (
                  <div key={action} className="px-3">
                    <HotkeyRow action={action} config={config} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
