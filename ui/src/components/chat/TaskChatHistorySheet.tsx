import { useState } from "react"
import { IconHistory } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { TaskChatHistoryPanel } from "./TaskChatHistoryPanel"

/**  Button that opens the task chat history panel in a sheet/drawer. */
export function TaskChatHistorySheet({ className, onSelectSession }: TaskChatHistorySheetProps) {
  const [open, setOpen] = useState(false)

  const handleSelectSession = (sessionId: string) => {
    onSelectSession?.(sessionId)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "text-muted-foreground hover:text-foreground rounded p-1 transition-colors",
          className,
        )}
        aria-label="View chat history"
        title="Chat history"
      >
        <IconHistory className="size-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" size="lg" className="p-0">
          <SheetTitle className="sr-only">Chat History</SheetTitle>
          <TaskChatHistoryPanel className="h-full" onSelectSession={handleSelectSession} />
        </SheetContent>
      </Sheet>
    </>
  )
}

export interface TaskChatHistorySheetProps {
  /** Optional CSS class to apply to the trigger button */
  className?: string
  /** Callback when a session is selected */
  onSelectSession?: (sessionId: string) => void
}
