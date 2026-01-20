import { useCallback, useMemo, useState, useEffect } from "react"
import { Command } from "cmdk"
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerPause,
  IconLayoutSidebar,
  IconSun,
  IconKeyboard,
  IconMessage,
  IconListCheck,
  IconTerminal,
  IconSearch,
} from "@tabler/icons-react"
import { hotkeys, type HotkeyAction, type HotkeyConfig } from "@/config"
import type { RalphStatus } from "@/store"

// Types

export interface CommandPaletteProps {
  /** Whether the command palette is open */
  open: boolean
  /** Callback when the command palette should close */
  onClose: () => void
  /** Command handlers */
  handlers: Partial<Record<CommandAction, () => void>>
  /** Current Ralph status for conditional rendering */
  ralphStatus?: RalphStatus
  /** Whether connected to the server */
  isConnected?: boolean
}

export type CommandAction =
  | "agentStart"
  | "agentStop"
  | "agentPause"
  | "toggleSidebar"
  | "cycleTheme"
  | "showHotkeys"
  | "focusTaskInput"
  | "focusChatInput"
  | "toggleTaskChat"

interface CommandItem {
  id: CommandAction
  label: string
  description?: string
  icon: React.ReactNode
  keywords?: string[]
  /** Optional condition to determine if command is available */
  available?: () => boolean
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
 * Get the keyboard shortcut display for an action
 */
function getShortcut(action: HotkeyAction): string | undefined {
  const config = hotkeys[action]
  return config ? getHotkeyDisplayString(config) : undefined
}

// CommandPalette Component

/**
 * Command palette for quick access to application actions.
 * Opens with Cmd+; and provides fuzzy search across all commands.
 */
export function CommandPalette({
  open,
  onClose,
  handlers,
  ralphStatus = "stopped",
  isConnected = false,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch("")
    }
  }, [open])

  // Define all available commands
  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "agentStart",
        label: "Start Ralph",
        description: "Start the Ralph agent",
        icon: <IconPlayerPlay className="h-4 w-4" />,
        keywords: ["run", "begin", "launch", "agent"],
        available: () => ralphStatus === "stopped" && isConnected,
      },
      {
        id: "agentStop",
        label: "Stop Ralph",
        description: "Stop the Ralph agent",
        icon: <IconPlayerStop className="h-4 w-4" />,
        keywords: ["halt", "end", "terminate", "agent"],
        available: () => ralphStatus === "running" && isConnected,
      },
      {
        id: "agentPause",
        label: ralphStatus === "paused" ? "Resume Ralph" : "Pause Ralph",
        description: ralphStatus === "paused" ? "Resume the Ralph agent" : "Pause the Ralph agent",
        icon: <IconPlayerPause className="h-4 w-4" />,
        keywords: ["pause", "resume", "suspend", "agent"],
        available: () => (ralphStatus === "running" || ralphStatus === "paused") && isConnected,
      },
      {
        id: "toggleSidebar",
        label: "Toggle Sidebar",
        description: "Show or hide the sidebar",
        icon: <IconLayoutSidebar className="h-4 w-4" />,
        keywords: ["sidebar", "panel", "show", "hide", "collapse", "expand"],
      },
      {
        id: "cycleTheme",
        label: "Toggle Theme",
        description: "Cycle through light, dark, and system themes",
        icon: <IconSun className="h-4 w-4" />,
        keywords: ["theme", "dark", "light", "mode", "appearance", "color"],
      },
      {
        id: "showHotkeys",
        label: "Keyboard Shortcuts",
        description: "Show all keyboard shortcuts",
        icon: <IconKeyboard className="h-4 w-4" />,
        keywords: ["hotkeys", "keys", "bindings", "help", "shortcuts"],
      },
      {
        id: "focusTaskInput",
        label: "New Task",
        description: "Focus the quick task input",
        icon: <IconListCheck className="h-4 w-4" />,
        keywords: ["task", "create", "add", "new", "issue", "todo"],
      },
      {
        id: "focusChatInput",
        label: "Focus Chat",
        description: "Focus the chat input",
        icon: <IconMessage className="h-4 w-4" />,
        keywords: ["chat", "message", "input", "type", "send"],
      },
      {
        id: "toggleTaskChat",
        label: "Toggle Task Chat",
        description: "Show or hide the task chat panel",
        icon: <IconTerminal className="h-4 w-4" />,
        keywords: ["task", "chat", "panel", "show", "hide"],
      },
    ],
    [ralphStatus, isConnected],
  )

  const handleSelect = useCallback(
    (action: CommandAction) => {
      const handler = handlers[action]
      if (handler) {
        handler()
      }
      onClose()
    },
    [handlers, onClose],
  )

  // Filter out unavailable commands
  const availableCommands = useMemo(
    () => commands.filter(cmd => !cmd.available || cmd.available()),
    [commands],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" data-testid="command-palette">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} data-testid="command-backdrop" />

      {/* Command dialog */}
      <div className="fixed top-[20%] left-1/2 w-full max-w-lg -translate-x-1/2">
        <Command
          className="bg-background border-border overflow-hidden rounded-lg border shadow-2xl"
          loop
        >
          <div className="border-border flex items-center gap-2 border-b px-3">
            <IconSearch className="text-muted-foreground h-4 w-4 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="placeholder:text-muted-foreground w-full border-0 bg-transparent py-3 text-sm outline-none"
              data-testid="command-input"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="text-muted-foreground py-6 text-center text-sm">
              No commands found.
            </Command.Empty>

            <Command.Group>
              {availableCommands.map(command => {
                const shortcut = getShortcut(command.id)
                return (
                  <Command.Item
                    key={command.id}
                    value={`${command.label} ${command.keywords?.join(" ") ?? ""}`}
                    onSelect={() => handleSelect(command.id)}
                    className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm"
                    data-testid={`command-item-${command.id}`}
                  >
                    <span className="text-muted-foreground">{command.icon}</span>
                    <div className="flex flex-1 flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-muted-foreground text-xs">{command.description}</span>
                      )}
                    </div>
                    {shortcut && (
                      <kbd className="bg-muted text-muted-foreground border-border ml-auto shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs">
                        {shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                )
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
