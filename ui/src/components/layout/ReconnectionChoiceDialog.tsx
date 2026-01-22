import { useCallback } from "react"
import { IconPlugConnected, IconRefresh, IconTrash } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

/**
 * Dialog shown when the WebSocket reconnects while an iteration was in progress.
 * Gives the user a choice to continue from where they left off or start fresh.
 */
export function ReconnectionChoiceDialog({
  open,
  onContinue,
  onStartFresh,
}: ReconnectionChoiceDialogProps) {
  const handleContinue = useCallback(() => {
    onContinue?.()
  }, [onContinue])

  const handleStartFresh = useCallback(() => {
    onStartFresh?.()
  }, [onStartFresh])

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[425px]"
        data-testid="reconnection-choice-dialog"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPlugConnected className="text-status-warning size-5" />
            Connection Restored
          </DialogTitle>
          <DialogDescription>
            The connection was lost while an iteration was in progress. How would you like to
            proceed?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Continue option */}
          <button
            type="button"
            onClick={handleContinue}
            className="hover:bg-muted/50 border-border focus:ring-ring w-full rounded-lg border p-4 text-left transition-colors focus:ring-2 focus:outline-none"
            data-testid="reconnection-continue-button"
          >
            <div className="flex items-start gap-3">
              <IconRefresh className="text-primary mt-0.5 size-5 flex-shrink-0" />
              <div>
                <div className="font-medium">Continue from where we left off</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  Resume the iteration with the preserved conversation context. The agent will
                  continue working on the current task.
                </div>
              </div>
            </div>
          </button>

          {/* Start fresh option */}
          <button
            type="button"
            onClick={handleStartFresh}
            className="hover:bg-muted/50 border-border focus:ring-ring w-full rounded-lg border p-4 text-left transition-colors focus:ring-2 focus:outline-none"
            data-testid="reconnection-start-fresh-button"
          >
            <div className="flex items-start gap-3">
              <IconTrash className="text-muted-foreground mt-0.5 size-5 flex-shrink-0" />
              <div>
                <div className="font-medium">Start fresh</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  Discard any partial progress and begin a new iteration. Use this if the previous
                  work was incomplete or problematic.
                </div>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter className="text-muted-foreground text-xs">
          <span>Choose an option to continue using the application.</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type ReconnectionChoiceDialogProps = {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when user chooses to continue from where they left off */
  onContinue?: () => void
  /** Callback when user chooses to start fresh */
  onStartFresh?: () => void
}
