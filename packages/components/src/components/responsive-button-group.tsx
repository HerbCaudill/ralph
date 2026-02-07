import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "../lib/cn"
import { ButtonGroup } from "./button-group"

/**
 * A responsive button group that automatically collapses to icon-only buttons
 * when the content would overflow the available space.
 *
 * Measures actual content width vs available space using ResizeObserver and
 * useLayoutEffect, so no hardcoded breakpoint is needed.
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
export function ResponsiveButtonGroup({ className, ...props }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  /** Remembered full-width measurement so we know when it's safe to expand again. */
  const fullWidthRef = useRef<number>(0)
  const collapsedRef = useRef(false)

  // After each render, check if expanded content overflows.
  // useLayoutEffect runs before paint, so the user never sees a clipped state.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || collapsedRef.current) return

    const contentWidth = container.scrollWidth
    fullWidthRef.current = contentWidth
    if (contentWidth > container.clientWidth) {
      collapsedRef.current = true
      setCollapsed(true)
    }
  })

  // Watch for container resize to know when there's room to expand again.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (collapsedRef.current && container.clientWidth >= fullWidthRef.current) {
        collapsedRef.current = false
        setCollapsed(false)
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
      <ButtonGroup
        className={cn(
          "bg-background h-8",
          collapsed && "**:data-label:hidden [&>button]:gap-0 [&>button]:px-1.5",
          className,
        )}
        {...props}
      />
    </div>
  )
}

type Props = React.ComponentProps<typeof ButtonGroup>
