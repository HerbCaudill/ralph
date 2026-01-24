import { cn } from "@/lib/utils"
import { IconAlertTriangle } from "@tabler/icons-react"
import type { ErrorEventData } from "@/types"

/**  Renders an error event with red styling to indicate something went wrong. */
export function ErrorEvent({ event, className }: Props) {
  const isServerError = event.type === "server_error"

  return (
    <div
      className={cn(
        "mx-4 my-2 flex items-start gap-3 rounded-lg border px-4 py-3",
        "bg-status-error/5 border-status-error text-status-error",
        className,
      )}
      data-testid="error-event"
      data-error-type={event.type}
    >
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full")}>
        <IconAlertTriangle className="size-8" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-xs font-medium tracking-wide uppercase", "text-status")}>
          {isServerError ? "Server Error" : "Error"}
        </span>
        <span className="text-foreground text-sm">{event.error}</span>
      </div>
    </div>
  )
}

/**  Props for ErrorEvent component */
type Props = {
  /** The error event data to display */
  event: ErrorEventData
  /** Optional CSS class to apply to the container */
  className?: string
}
