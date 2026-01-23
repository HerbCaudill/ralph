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

/** Map icon names from config to React components */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PlayerPlay: IconPlayerPlay,
  PlayerStop: IconPlayerStop,
  PlayerPause: IconPlayerPause,
  LayoutSidebar: IconLayoutSidebar,
  Sun: IconSun,
  Keyboard: IconKeyboard,
  Message: IconMessage,
  ListCheck: IconListCheck,
  Terminal: IconTerminal,
}

/** Get icon component from config icon name */
function getIcon(iconName: string): React.ReactNode {
  const IconComponent = iconMap[iconName]
  if (IconComponent) {
    return <IconComponent className="h-4 w-4" />
  }
  return null
}

/** Availability rules for commands based on app state */
type AvailabilityRule = (ralphStatus: RalphStatus, isConnected: boolean) => boolean

const availabilityRules: Partial<Record<CommandAction, AvailabilityRule>> = {
  agentStart: (status, connected) => status === "stopped" && connected,
  agentStop: (status, connected) => status === "running" && connected,
  agentPause: (status, connected) => (status === "running" || status === "paused") && connected,
}

/** Dynamic label overrides based on app state */
type LabelOverride = (ralphStatus: RalphStatus) => string

const labelOverrides: Partial<Record<CommandAction, LabelOverride>> = {
  agentPause: status => (status === "paused" ? "Resume Ralph" : "Pause Ralph"),
}

/**
 * Command palette for quick access to application actions.
 * Opens with Cmd+; and provides fuzzy search across all commands.
 * Commands are driven by the hotkeys configuration file.
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

  /**
   * Handle Escape key to close the command palette.
   */
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

  /**
   * Build commands from hotkeys configuration.
   * Only includes hotkeys that have commandPalette config.
   */
  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = []

    for (const [action, config] of Object.entries(hotkeys)) {
      if (!config.commandPalette) continue

      const actionId = action as CommandAction
      const { label, icon, keywords } = config.commandPalette

      // Apply dynamic label override if exists
      const labelOverride = labelOverrides[actionId]
      const displayLabel = labelOverride ? labelOverride(ralphStatus) : label

      // Apply availability rule if exists
      const availabilityRule = availabilityRules[actionId]
      const available =
        availabilityRule ? () => availabilityRule(ralphStatus, isConnected) : undefined

      items.push({
        id: actionId,
        label: displayLabel,
        description: config.description,
        icon: getIcon(icon),
        keywords,
        available,
      })
    }

    return items
  }, [ralphStatus, isConnected])

  /**
   * Handle command selection and invoke the associated handler.
   */
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

  /**
   * Filter commands to only show those available in current state.
   */
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
