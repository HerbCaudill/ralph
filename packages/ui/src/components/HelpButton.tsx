import { IconHelp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/**
 * Help button that opens the hotkeys reference dialog.
 * Displays a help icon in the header toolbar.
 */
export function HelpButton({ className, textColor, onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Keyboard shortcuts"
      aria-label="Keyboard shortcuts"
      data-testid="help-button"
      className={cn("rounded p-1.5 hover:bg-white/20", className)}
      style={{ color: textColor }}
    >
      <IconHelp className="size-5" />
    </button>
  )
}

export type HelpButtonProps = {
  className?: string
  /** Text color to use for the icon */
  textColor?: string
  /** Callback when the button is clicked */
  onClick: () => void
}
