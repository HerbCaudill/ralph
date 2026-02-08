import { IconChevronDown } from "@tabler/icons-react"
import { Button } from "@herbcaudill/components"
import { cn } from "../lib/utils"

/**
 * A floating button that scrolls the container to the bottom.
 * Used in EventStream and TaskChat for consistent scroll-to-bottom behavior.
 */
export function ScrollToBottomButton({
  isVisible,
  onClick,
  ariaLabel = "Scroll to latest",
  className,
}: ScrollToBottomButtonProps) {
  if (!isVisible) return null

  return (
    <Button
      onClick={onClick}
      className={cn(
        "absolute right-4 bottom-[46px] z-10 rounded-full shadow-lg transition-opacity hover:opacity-90",
        className,
      )}
      aria-label={ariaLabel}
    >
      <IconChevronDown className="size-4" />
      <span className="pr-1 text-xs font-medium">Latest</span>
    </Button>
  )
}

export type ScrollToBottomButtonProps = {
  /** Whether the button should be visible */
  isVisible: boolean
  /** Click handler to scroll to bottom */
  onClick: () => void
  /** Aria label for accessibility */
  ariaLabel?: string
  /** Additional class names */
  className?: string
}
