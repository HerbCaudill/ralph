import { useState, useEffect, useMemo } from "react"
import type { ChatEvent } from "@herbcaudill/agent-view"

/**
 * Hook that calculates and tracks session duration.
 * Returns formatted elapsed time since the first event.
 */
export function useSessionTimer(
  /** The events to calculate duration from */
  events: ChatEvent[],
): UseSessionTimerReturn {
  const [now, setNow] = useState(Date.now())

  // Find the timestamp of the first event
  const startTime = useMemo(() => {
    if (events.length === 0) return null
    // Find first event with timestamp
    const firstEvent = events[0]
    if (firstEvent && "timestamp" in firstEvent && firstEvent.timestamp) {
      return new Date(firstEvent.timestamp).getTime()
    }
    return null
  }, [events])

  // Update "now" every second while session is active
  useEffect(() => {
    if (!startTime) return
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  // Calculate elapsed time
  const elapsedMs = startTime ? now - startTime : 0
  const formatted = formatDuration(elapsedMs)

  return {
    startTime,
    elapsedMs,
    formatted,
  }
}

/**
 * Format milliseconds as "HH:MM:SS" or "MM:SS"
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return "00:00"

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, "0")

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

export interface UseSessionTimerReturn {
  /** Start time in ms since epoch, or null if no events */
  startTime: number | null
  /** Elapsed time in milliseconds */
  elapsedMs: number
  /** Formatted duration string (e.g., "05:32" or "1:23:45") */
  formatted: string
}
