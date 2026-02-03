import { IconClock } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

/**
 * Displays elapsed session time with a clock icon.
 *
 * Shows formatted elapsed time in the format:
 * - "5s" for less than 60 seconds
 * - "1:05" for less than 60 minutes
 * - "1:02:03" for 60+ minutes
 *
 * Hidden when elapsed time is 0 or negative.
 */
export function RunDuration({ elapsedMs, className }: RunDurationProps) {
  // Don't render if no elapsed time
  if (elapsedMs <= 0) return null

  const formatted = formatElapsedTime(elapsedMs)

  return (
    <div
      className={cn("text-muted-foreground flex items-center gap-1 text-xs", className)}
      title="Time running"
      data-testid="run-duration"
    >
      <IconClock className="size-3 shrink-0" />
      <span>{formatted}</span>
    </div>
  )
}

/**
 * Format milliseconds as human-readable duration.
 * - Under 60s: "5s"
 * - Under 60m: "1:05"
 * - 60m+: "1:02:03"
 */
function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
  return `${seconds}s`
}

export type RunDurationProps = {
  /** Elapsed time in milliseconds. */
  elapsedMs: number
  /** Additional CSS classes. */
  className?: string
}
