import { IconHelp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store"
import { Button } from "@/components/ui/button"

/**
 * Help button that opens the hotkeys reference dialog.
 * Displays a help icon in the header toolbar.
 */
export function HelpButton({ className, textColor }: HelpButtonProps) {
  const openHotkeysDialog = useAppStore(state => state.openHotkeysDialog)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={openHotkeysDialog}
      title="Keyboard shortcuts"
      aria-label="Keyboard shortcuts"
      data-testid="help-button"
      className={cn("hover:bg-white/20", className)}
      style={{ color: textColor }}
    >
      <IconHelp className="size-4" />
    </Button>
  )
}

export type HelpButtonProps = {
  className?: string
  /** Text color to use for the icon */
  textColor?: string
}
