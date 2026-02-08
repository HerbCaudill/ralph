import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/cn"
import { Separator } from "./separator"

const buttonGroupVariants = cva(
  "border border-border flex w-fit items-stretch rounded-md border text-[11px] [&>*]:whitespace-nowrap [&_*]:whitespace-nowrap [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md has-[>[data-slot=button-group]]:gap-2 [&>[data-slot=button]]:border-0 [&>[data-slot=button]]:shadow-none",
  {
    variants: {
      orientation: {
        horizontal:
          "divide-x divide-border [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col divide-y divide-border [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none",
      },
      size: {
        default: "text-sm",
        sm: "text-xs",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
      size: "default",
    },
  },
)

/**
 * A group of buttons rendered as a unified control with shared borders.
 *
 * When `responsive` is true, automatically collapses to icon-only buttons when
 * content would overflow. Uses a ResizeObserver to measure actual content width
 * vs available space, so no hardcoded breakpoint is needed. Button children
 * should include an icon element and a `<span data-label>` for the text label.
 */
function ButtonGroup({
  className,
  orientation,
  size,
  responsive = false,
  ...props
}: ButtonGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  /** Remembered full-width measurement so we know when it's safe to expand again. */
  const fullWidthRef = useRef<number>(0)
  const collapsedRef = useRef(false)

  // After initial render, check if content overflows before paint.
  useLayoutEffect(() => {
    if (!responsive) return
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
  useEffect(() => {
    if (!responsive) return
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (collapsedRef.current) {
        if (container.clientWidth >= fullWidthRef.current) {
          collapsedRef.current = false
          setCollapsed(false)
        }
      } else {
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
  }, [responsive])

  const heightClass = size === "sm" ? "h-6" : "h-8"

  const groupDiv = (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        buttonGroupVariants({ orientation, size }),
        responsive && "bg-background overflow-hidden",
        responsive && heightClass,
        responsive &&
          collapsed &&
          [
            "[&>*:not(:hover):not([aria-pressed=true])_[data-label]]:hidden",
            "[&>*:not(:hover):not([aria-pressed=true])]:gap-0",
            "[&>*:not(:hover):not([aria-pressed=true])]:px-1.5",
          ].join(" "),
        className,
      )}
      {...props}
    />
  )

  if (responsive) {
    return (
      <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
        {groupDiv}
      </div>
    )
  }

  return groupDiv
}

/** A text label inside a ButtonGroup. */
function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      className={cn(
        "bg-muted flex items-center gap-2 rounded-md px-4 text-xs font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

/** A visual separator between groups of buttons. */
function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "bg-border relative m-0! self-stretch data-[orientation=vertical]:h-auto",
        className,
      )}
      {...props}
    />
  )
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants }

type ButtonGroupProps = React.ComponentProps<"div"> &
  VariantProps<typeof buttonGroupVariants> & {
    /** When true, collapses to icon-only when content overflows. */
    responsive?: boolean
  }
