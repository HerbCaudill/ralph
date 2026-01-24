import { cn } from "@/lib/utils"
import { IconAlertTriangle } from "@tabler/icons-react"
import type { ErrorEventData } from "@/types"

/**  Renders an error event with red styling to indicate something went wrong. */
export function ErrorEvent({ event, className }: Props) {
  const isServerError = event.type === "server_error"

  return (
    <div
      className={cn(
        "mx-4 my-2 flex items-center gap-3 rounded-lg border px-4 py-3",
        "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50",
        className,
      )}
      data-testid="error-event"
      data-error-type={event.type}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
        )}
      >
        <IconAlertTriangle className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            "text-red-600 dark:text-red-400",
          )}
        >
          {isServerError ? "Server Error" : "Error"}
        </span>
        <span className="text-status-error text-sm">{event.error}</span>
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
