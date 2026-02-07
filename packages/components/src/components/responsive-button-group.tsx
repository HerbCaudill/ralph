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

  // After initial render, check if content overflows before paint.
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

  // Watch for container resize to collapse or expand as needed.
  // The useLayoutEffect above handles initial render and re-renders (e.g. after
  // expanding), but only ResizeObserver can detect external size changes like
  // the parent shrinking via CSS resize or layout shifts.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (collapsedRef.current) {
        // Collapsed: check if there's room to expand
        if (container.clientWidth >= fullWidthRef.current) {
          collapsedRef.current = false
          setCollapsed(false)
        }
      } else {
        // Expanded: check if content now overflows
        const contentWidth = container.scrollWidth
        fullWidthRef.current = contentWidth
        if (contentWidth > container.clientWidth) {
          collapsedRef.current = true
          setCollapsed(true)
        }
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
