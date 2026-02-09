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

/** Simple dialog showing all available keyboard shortcuts. */
export function HotkeysDialog(
  /** Props for HotkeysDialog. */
  { open, onClose, hotkeys }: HotkeysDialogProps,
) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="w-80 p-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <IconKeyboard className="h-5 w-5 text-muted-foreground" />
            <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-1">
          {hotkeys.map(({ action, display, description }) => (
            <div key={action} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground">{description}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {display}
              </kbd>
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
  /** Hotkeys to display in the dialog. */
  hotkeys: Array<{ action: string; display: string; description: string }>
}
