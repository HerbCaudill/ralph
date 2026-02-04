import { cn } from "@/lib/utils"
import { IconDatabaseOff, IconRefresh, IconX } from "@tabler/icons-react"
import { useAppStore, selectPersistenceError } from "@/store"
import { writeQueue } from "@/lib/persistence"

export type PersistenceErrorNotificationProps = {
  /** Text color for display (for header variant) */
  textColor?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Displays a notification when IndexedDB writes have persistently failed.
 * Shows in the header area with an error style to alert the user.
 * Provides options to retry or dismiss the error.
 */
export function PersistenceErrorNotification({
  textColor,
  className,
}: PersistenceErrorNotificationProps) {
  const persistenceError = useAppStore(selectPersistenceError)
  const clearPersistenceError = useAppStore(state => state.clearPersistenceError)

  // Only show when there's a persistence error
  if (!persistenceError) {
    return null
  }

  const handleRetry = () => {
    // Clear the error state first
    clearPersistenceError()
    // Then retry the failed writes
    writeQueue.retryFailedWrites()
  }

  const handleDismiss = () => {
    // Clear the error state
    clearPersistenceError()
    // Also clear the failed writes queue (user chose to ignore)
    writeQueue.clearFailures()
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5",
        "border border-red-500/30 bg-red-500/20",
        className,
      )}
      data-testid="persistence-error-notification"
    >
      <IconDatabaseOff className="size-4 shrink-0 text-red-500" aria-hidden="true" />
      <span className="text-sm font-medium" style={{ color: textColor }}>
        Failed to save{" "}
        <span className="font-semibold">
          {persistenceError.failedCount} event{persistenceError.failedCount !== 1 ? "s" : ""}
        </span>{" "}
        to local storage
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={handleRetry}
          className="rounded p-1 transition-colors hover:bg-red-500/20"
          title="Retry saving"
          aria-label="Retry saving failed events"
        >
          <IconRefresh className="size-3.5 text-red-500" />
        </button>
        <button
          onClick={handleDismiss}
          className="rounded p-1 transition-colors hover:bg-red-500/20"
          title="Dismiss"
          aria-label="Dismiss persistence error"
        >
          <IconX className="size-3.5 text-red-500" />
        </button>
      </div>
    </div>
  )
}
