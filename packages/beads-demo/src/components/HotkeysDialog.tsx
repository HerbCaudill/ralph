import { useEffect, useRef } from "react"
import { IconKeyboard } from "@tabler/icons-react"

export type HotkeysDialogProps = {
  open: boolean
  onClose: () => void
  hotkeys: Array<{ action: string; display: string; description: string }>
}

/**
 * Simple dialog showing all available keyboard shortcuts.
 * Uses the native HTML dialog element for accessibility.
 */
export function HotkeysDialog({ open, onClose, hotkeys }: HotkeysDialogProps) {
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

  return (
    <dialog
      ref={dialogRef}
      className="m-auto rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="w-80 p-4">
        <div className="mb-4 flex items-center gap-2">
          <IconKeyboard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
        </div>

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
