import { useCallback, useMemo, useState, useEffect } from "react"
import { Command } from "cmdk"
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerPause,
  IconSun,
  IconKeyboard,
} from "@tabler/icons-react"

export type CommandAction = "agentStart" | "agentStop" | "agentPause" | "cycleTheme" | "showHotkeys"

type CommandItem = {
  id: CommandAction
  label: string
  description?: string
  icon: React.ReactNode
  keywords?: string[]
  available?: () => boolean
}

export type CommandPaletteProps = {
  open: boolean
  onClose: () => void
  handlers: Partial<Record<CommandAction, () => void>>
  controlState?: "idle" | "running" | "paused"
  isConnected?: boolean
}

/**
 * Command palette for quick access to application actions.
 * Opens with Cmd+;, provides fuzzy search across commands.
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

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "agentStart",
        label: "Start Ralph",
        description: "Start the Ralph agent",
        icon: <IconPlayerPlay className="h-4 w-4" />,
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
        label: "Cycle Theme",
        description: "Switch between light, dark, and system theme",
        icon: <IconSun className="h-4 w-4" />,
      },
      {
        id: "showHotkeys",
        label: "Show Keyboard Shortcuts",
        description: "Display available keyboard shortcuts",
        icon: <IconKeyboard className="h-4 w-4" />,
      },
    ],
    [controlState, isConnected],
  )

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
      <Command className="fixed inset-x-0 top-20 z-50 mx-auto w-[480px] max-w-[90vw] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search..."
          autoFocus
          className="w-full border-b border-border bg-background px-3 py-2 text-sm outline-none"
        />
        <Command.List className="max-h-[400px] overflow-y-auto">
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
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}
