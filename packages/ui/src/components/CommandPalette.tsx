import { useCallback, useMemo, useState, useEffect } from "react"
import { Command } from "cmdk"
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerPause,
  IconSun,
  IconKeyboard,
  IconCommand,
  IconArrowDown,
  IconMessage,
  IconEye,
  IconSearch,
  IconChevronUp,
  IconChevronDown,
  IconCornerDownLeft,
} from "@tabler/icons-react"
import {
  hotkeys as agentHotkeys,
  getHotkeyDisplayString,
  type AgentHotkeyAction,
} from "@herbcaudill/agent-view"
import {
  hotkeys as beadsHotkeys,
  getHotkeyDisplayString as getBeadsHotkeyDisplayString,
  type BeadsHotkeyAction,
} from "@herbcaudill/beads-view"

/** All actions available in the command palette. */
export type CommandAction =
  | "agentStart"
  | "agentStop"
  | "agentPause"
  | "cycleTheme"
  | "showHotkeys"
  | "focusChatInput"
  | "newSession"
  | "toggleToolOutput"
  | "scrollToBottom"
  | "startRalph"
  | "focusSearch"
  | "previousTask"
  | "nextTask"
  | "openTask"

/** Single command entry in the palette. */
type CommandItem = {
  id: CommandAction
  label: string
  description?: string
  icon: React.ReactNode
  shortcut?: string
  keywords?: string[]
  available?: () => boolean
}

/**
 * Command palette for quick access to application actions.
 * Opens with Cmd+;, provides fuzzy search across commands.
 * Includes all hotkey actions so users can discover keyboard-accessible commands.
 */
export function CommandPalette({
  open,
  onClose,
  handlers,
  controlState = "idle",
  isConnected = false,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (open) setSearch("")
  }, [open])

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

  /** Icon lookup for agent hotkey actions. */
  const agentHotkeyIcons: Record<AgentHotkeyAction, React.ReactNode> = useMemo(
    () => ({
      focusChatInput: <IconMessage className="h-4 w-4" />,
      newSession: <IconCommand className="h-4 w-4" />,
      toggleToolOutput: <IconEye className="h-4 w-4" />,
      scrollToBottom: <IconArrowDown className="h-4 w-4" />,
      showHotkeys: <IconKeyboard className="h-4 w-4" />,
      startRalph: <IconPlayerPlay className="h-4 w-4" />,
    }),
    [],
  )

  /** Icon lookup for beads hotkey actions. */
  const beadsHotkeyIcons: Record<BeadsHotkeyAction, React.ReactNode> = useMemo(
    () => ({
      focusSearch: <IconSearch className="h-4 w-4" />,
      previousTask: <IconChevronUp className="h-4 w-4" />,
      nextTask: <IconChevronDown className="h-4 w-4" />,
      openTask: <IconCornerDownLeft className="h-4 w-4" />,
      showHotkeys: <IconKeyboard className="h-4 w-4" />,
    }),
    [],
  )

  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Core Ralph control commands
      {
        id: "agentStart",
        label: "Start Ralph",
        description: "Start the Ralph agent",
        icon: <IconPlayerPlay className="h-4 w-4" />,
        shortcut: getHotkeyDisplayString(agentHotkeys.startRalph),
        available: () => controlState === "idle" && isConnected,
      },
      {
        id: "agentStop",
        label: "Stop Ralph",
        description: "Stop the Ralph agent",
        icon: <IconPlayerStop className="h-4 w-4" />,
        available: () => controlState === "running" && isConnected,
      },
      {
        id: "agentPause",
        label: controlState === "paused" ? "Resume Ralph" : "Pause Ralph",
        description: controlState === "paused" ? "Resume the Ralph agent" : "Pause the Ralph agent",
        icon: <IconPlayerPause className="h-4 w-4" />,
        available: () => (controlState === "running" || controlState === "paused") && isConnected,
      },
      {
        id: "cycleTheme",
        label: "Cycle theme",
        description: "Switch between light, dark, and system theme",
        icon: <IconSun className="h-4 w-4" />,
      },
    ]

    // Add agent-view hotkey actions (skip showHotkeys and startRalph since they're already included)
    const skipAgentActions = new Set<string>(["showHotkeys", "startRalph"])
    for (const [action, config] of Object.entries(agentHotkeys)) {
      if (skipAgentActions.has(action)) continue
      items.push({
        id: action as CommandAction,
        label: config.description,
        icon: agentHotkeyIcons[action as AgentHotkeyAction],
        shortcut: getHotkeyDisplayString(config),
      })
    }

    // Add beads-view hotkey actions (skip duplicates already in agent-view)
    const existingActions = new Set(items.map(i => i.id))
    for (const [action, config] of Object.entries(beadsHotkeys)) {
      if (existingActions.has(action as CommandAction)) continue
      items.push({
        id: action as CommandAction,
        label: config.description,
        icon: beadsHotkeyIcons[action as BeadsHotkeyAction],
        shortcut: getBeadsHotkeyDisplayString(config),
      })
    }

    return items
  }, [controlState, isConnected, agentHotkeyIcons, beadsHotkeyIcons])

  const filteredCommands = useMemo(
    () => commands.filter(cmd => cmd.available?.() !== false),
    [commands],
  )

  const handleSelect = useCallback(
    (action: CommandAction) => {
      handlers[action]?.()
      onClose()
    },
    [handlers, onClose],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <Command className="fixed inset-x-0 top-20 z-50 mx-auto w-120 max-w-[90vw] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search..."
          autoFocus
          className="w-full border-b border-border bg-background px-3 py-2 text-sm outline-none"
        />
        <Command.List className="max-h-100 overflow-y-auto">
          <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
            No commands found.
          </Command.Empty>
          {filteredCommands.map(cmd => (
            <Command.Item
              key={cmd.id}
              value={cmd.label}
              onSelect={() => handleSelect(cmd.id)}
              className="flex cursor-pointer items-start gap-3 px-4 py-3 data-[selected=true]:bg-muted"
            >
              <div className="mt-0.5 text-muted-foreground">{cmd.icon}</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{cmd.label}</div>
                {cmd.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{cmd.description}</p>
                )}
              </div>
              {cmd.shortcut && (
                <kbd className="mt-0.5 shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {cmd.shortcut}
                </kbd>
              )}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}

export type CommandPaletteProps = {
  /** Whether the palette is open. */
  open: boolean
  /** Callback when the palette is closed. */
  onClose: () => void
  /** Handler callbacks for each action. */
  handlers: Partial<Record<CommandAction, () => void>>
  /** Current control state of the Ralph agent. */
  controlState?: "idle" | "running" | "paused"
  /** Whether the agent server is connected. */
  isConnected?: boolean
}
