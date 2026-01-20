import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

// Provider

const TooltipProvider = TooltipPrimitive.Provider

// Root

const Tooltip = TooltipPrimitive.Root

// Trigger

const TooltipTrigger = TooltipPrimitive.Trigger

// Content

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 overflow-hidden rounded-md border px-3 py-1.5 text-sm shadow-md",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Kbd (for displaying keyboard shortcuts)

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

function Kbd({ children, className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "bg-muted text-muted-foreground pointer-events-none ml-2 inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-xs font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}

// TooltipButton - a convenience wrapper for buttons with tooltips and optional hotkeys

interface TooltipButtonProps {
  children: React.ReactNode
  tooltip: string
  hotkey?: string
  side?: "top" | "right" | "bottom" | "left"
  delayDuration?: number
}

function TooltipButton({
  children,
  tooltip,
  hotkey,
  side = "top",
  delayDuration = 300,
}: TooltipButtonProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      {/* Wrap children in a span so tooltips work on disabled buttons.
          Disabled elements don't fire pointer events, but the wrapper span does. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>
        <span className="flex items-center">
          {tooltip}
          {hotkey && <Kbd>{hotkey}</Kbd>}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Kbd, TooltipButton }
