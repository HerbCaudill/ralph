import { cn } from "../../lib/cn"
import { ButtonGroup } from "./button-group"

/**
 * A responsive button group that shows icon-only buttons when there's insufficient
 * horizontal space, and icon + text when there's enough room.
 *
 * Uses CSS container queries to detect available width and hide text labels
 * when the container is narrow.
 *
 * Button children should include:
 * - An icon element (any element without data-label)
 * - A span with data-label attribute for the text label
 *
 * Example:
 * ```tsx
 * <ResponsiveButtonGroup>
 *   <button>
 *     <IconCircle className="h-3.5 w-3.5" />
 *     <span data-label>Open</span>
 *   </button>
 * </ResponsiveButtonGroup>
 * ```
 */
export function ResponsiveButtonGroup({
  className,
  ...props
}: React.ComponentProps<typeof ButtonGroup>) {
  return (
    <div className="@container min-w-0 shrink">
      <ButtonGroup
        className={cn(
          "bg-background h-8 overflow-hidden",
          // When container is narrow (< 240px), hide the text labels
          "[&_[data-label]]:@max-[240px]:hidden",
          // When container is narrow, remove gap from buttons
          "[&>button]:@max-[240px]:gap-0",
          // Adjust padding when in icon-only mode
          "[&>button]:@max-[240px]:px-1.5",
          className,
        )}
        {...props}
      />
    </div>
  )
}
