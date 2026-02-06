import { useEffect, useRef } from "react"
import { IconKeyboard } from "@tabler/icons-react"
import { hotkeys as agentHotkeys, getHotkeyDisplayString } from "@herbcaudill/agent-view"
import {
  hotkeys as beadsHotkeys,
  getHotkeyDisplayString as getBeadsHotkeyDisplayString,
} from "@herbcaudill/beads-view"

export type HotkeysDialogProps = {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the dialog is closed */
  onClose: () => void
}

/**
 * Dialog showing all available keyboard shortcuts from agent-view and beads-view.
 * Combines hotkeys from both packages and displays them in a modal.
 */
export function HotkeysDialog({ open, onClose }: HotkeysDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Combine hotkeys from both packages, deduplicating shared actions (e.g. showHotkeys)
  const agentEntries = Object.entries(agentHotkeys).map(([action, config]) => ({
    key: `agent-${action}`,
    action,
    display: getHotkeyDisplayString(config),
    description: config.description,
    category: config.category,
  }))

  const agentActionNames = new Set(Object.keys(agentHotkeys))

  const beadsEntries = Object.entries(beadsHotkeys)
    .filter(([action]) => !agentActionNames.has(action))
    .map(([action, config]) => ({
      key: `beads-${action}`,
      action,
      display: getBeadsHotkeyDisplayString(config),
      description: config.description,
      category: config.category,
    }))

  const allHotkeys = [...agentEntries, ...beadsEntries]

  // Group by category
  const categories = allHotkeys.reduce(
    (acc, hotkey) => {
      if (!acc[hotkey.category]) {
        acc[hotkey.category] = []
      }
      acc[hotkey.category].push(hotkey)
      return acc
    },
    {} as Record<string, typeof allHotkeys>,
  )

  return (
    <dialog
      ref={dialogRef}
      className="m-auto rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="w-96 max-h-[80vh] overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-2">
          <IconKeyboard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
        </div>
        <div className="space-y-4">
          {Object.entries(categories).map(([category, hotkeys]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                {category}
              </h3>
              <div className="space-y-1">
                {hotkeys.map(({ key, display, description }) => (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{description}</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {display}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}
