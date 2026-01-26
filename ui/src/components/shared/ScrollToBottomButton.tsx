import { IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/**
 * A floating button that scrolls the container to the bottom.
 * Used in EventStream and TaskChatPanel for consistent scroll-to-bottom behavior.
 */
export function ScrollToBottomButton({
  isVisible,
  onClick,
  ariaLabel = "Scroll to latest",
  className,
}: ScrollToBottomButtonProps) {
  if (!isVisible) return null

  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-repo-accent text-repo-accent-foreground absolute right-4 bottom-4 z-10 rounded-full p-2 shadow-lg transition-opacity hover:opacity-90",
        "flex items-center gap-1.5",
        className,
      )}
      aria-label={ariaLabel}
    >
      <IconChevronDown className="size-4" />
      <span className="pr-1 text-xs font-medium">Latest</span>
    </button>
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
