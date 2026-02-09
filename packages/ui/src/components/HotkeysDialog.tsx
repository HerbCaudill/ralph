import { IconKeyboard } from "@tabler/icons-react"
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@herbcaudill/components"
import { hotkeys as agentHotkeys, getHotkeyDisplayString } from "@herbcaudill/agent-view"
import {
  hotkeys as beadsHotkeys,
  getHotkeyDisplayString as getBeadsHotkeyDisplayString,
} from "@herbcaudill/beads-view"

/** Dialog showing all available keyboard shortcuts from agent-view and beads-view. */
export function HotkeysDialog(
  /** Props for HotkeysDialog. */
  { open, onClose }: HotkeysDialogProps,
) {
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
    <Dialog open={open} onOpenChange={nextOpen => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="w-96 max-h-[80vh] overflow-y-auto p-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <IconKeyboard className="h-5 w-5 text-muted-foreground" />
            <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
          </div>
        </DialogHeader>
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
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type HotkeysDialogProps = {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback when the dialog is closed. */
  onClose: () => void
}
