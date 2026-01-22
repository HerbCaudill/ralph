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
} from "@tabler/icons-react"
import { hotkeys } from "@/config"
import { getShortcut } from "@/lib/getShortcut"
import type { RalphStatus } from "@/types"
import { Kbd } from "@/components/ui/tooltip"

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

  useEffect(() => {
    if (open) {
      setSearch("")
    }
  }, [open])

  // Handle Escape key to close the command palette
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

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
        onClose()
      }
    },
    [handlers, onClose],
  )

  const filteredCommands = useMemo(() => {
    return commands.filter(cmd => cmd.available?.() !== false)
  }, [commands])

  if (!open) {
    return null
  }

  return (
    <div data-testid="command-palette" className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/20"
        data-testid="command-backdrop"
        onClick={onClose}
      />
      <Command className="bg-popover text-foreground fixed inset-x-0 top-20 z-50 mx-auto w-[480px] max-w-[90vw] overflow-hidden rounded-lg border shadow-lg">
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search..."
          autoFocus
          className="border-border bg-background text-foreground w-full border-b px-3 py-2 text-sm outline-none"
          data-testid="command-input"
        />
        <Command.List className="bg-popover text-foreground max-h-[400px] overflow-y-auto">
          <Command.Empty className="text-muted-foreground p-4 text-center text-sm">
            No commands found.
          </Command.Empty>
          {filteredCommands.map(command => (
            <Command.Item
              key={command.id}
              value={command.label}
              keywords={command.keywords}
              onSelect={() => handleSelect(command.id)}
              className="data-[selected=true]:bg-muted flex items-start gap-3 px-4 py-3"
              data-testid={`command-item-${command.id}`}
            >
              <div className="text-muted-foreground mt-0.5">{command.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{command.label}</span>
                  {hotkeys[command.id] && (
                    <Kbd className="text-muted-foreground text-xs">{getShortcut(command.id)}</Kbd>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{command.description}</p>
              </div>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}

export type CommandPaletteProps = {
  open: boolean
  onClose: () => void
  handlers: Partial<Record<CommandAction, () => void>>
  ralphStatus?: RalphStatus
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

type CommandItem = {
  id: CommandAction
  label: string
  description?: string
  icon: React.ReactNode
  keywords?: string[]
  available?: () => boolean
}
