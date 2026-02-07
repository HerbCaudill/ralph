import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { IconX } from "@tabler/icons-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/cn"

const Sheet = DialogPrimitive.Root

const SheetTrigger = DialogPrimitive.Trigger

const SheetPortal = DialogPrimitive.Portal

const SheetClose = DialogPrimitive.Close

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const sheetVariants = cva(
  "bg-background fixed z-50 flex flex-col border shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
      size: {
        default: "",
        sm: "",
        lg: "",
        xl: "",
        full: "",
      },
    },
    compoundVariants: [
      { side: "left", size: "default", className: "w-3/4 max-w-sm" },
      { side: "left", size: "sm", className: "w-1/2 max-w-xs" },
      { side: "left", size: "lg", className: "w-3/4 max-w-lg" },
      { side: "left", size: "xl", className: "w-3/4 max-w-xl" },
      { side: "left", size: "full", className: "w-full" },
      { side: "right", size: "default", className: "w-3/4 max-w-sm" },
      { side: "right", size: "sm", className: "w-1/2 max-w-xs" },
      { side: "right", size: "lg", className: "w-3/4 max-w-lg" },
      { side: "right", size: "xl", className: "w-3/4 max-w-xl" },
      { side: "right", size: "full", className: "w-full" },
      { side: "top", size: "default", className: "h-1/3" },
      { side: "top", size: "sm", className: "h-1/4" },
      { side: "top", size: "lg", className: "h-1/2" },
      { side: "top", size: "xl", className: "h-2/3" },
      { side: "top", size: "full", className: "h-full" },
      { side: "bottom", size: "default", className: "h-1/3" },
      { side: "bottom", size: "sm", className: "h-1/4" },
      { side: "bottom", size: "lg", className: "h-1/2" },
      { side: "bottom", size: "xl", className: "h-2/3" },
      { side: "bottom", size: "full", className: "h-full" },
    ],
    defaultVariants: {
      side: "right",
      size: "default",
    },
  },
)

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof sheetVariants>
>(({ side = "right", size = "default", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(sheetVariants({ side, size }), className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
        <IconX className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 p-6 pb-0 text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse p-6 pt-0 sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-foreground text-lg font-semibold", className)}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetClose,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
