import { useState } from "react"
import { IconHistory } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { IterationHistoryPanel } from "./IterationHistoryPanel"

/**
 * Button that opens the iteration history panel in a sheet/drawer.
 */
export function IterationHistorySheet({ className }: IterationHistorySheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors",
          className,
        )}
        aria-label="View iteration history"
      >
        <IconHistory className="size-3.5" />
        <span>History</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" size="lg" className="p-0">
          <SheetTitle className="sr-only">Iteration History</SheetTitle>
          <IterationHistoryPanel className="h-full" />
        </SheetContent>
      </Sheet>
    </>
  )
}

export interface IterationHistorySheetProps {
  /** Optional CSS class to apply to the trigger button */
  className?: string
}
