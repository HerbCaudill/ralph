import { useMemo } from "react"
import { IconKeyboard } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { buildHotkeyCategories } from "@/lib/buildHotkeyCategories"
import { HotkeyRow } from "./HotkeyRow"

/**
 * Dialog showing all available keyboard shortcuts.
 * Organized by category for easy reference.
 */
export function HotkeysDialog({
  /** Whether the dialog is open */
  open,
  /** Callback when dialog should close */
  onClose,
}: HotkeysDialogProps) {
  const groupedHotkeys = useMemo(() => buildHotkeyCategories(), [])

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

/**
 * Props for the HotkeysDialog component
 */
export type HotkeysDialogProps = {
  open: boolean
  onClose: () => void
}
