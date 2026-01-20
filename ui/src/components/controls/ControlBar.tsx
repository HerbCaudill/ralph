import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TooltipButton } from "@/components/ui/tooltip"
import { useAppStore, selectRalphStatus, selectIsConnected } from "@/store"
import { useHotkeys } from "@/hooks"
import type { RalphStatus } from "@/store"
import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconPlayerStop,
} from "@tabler/icons-react"

// Types

export interface ControlBarProps {
  className?: string
}

// API Functions

async function startRalph(iterations?: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iterations }),
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to start" }
  }
}

async function stopRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to stop" }
  }
}

async function pauseRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to pause" }
  }
}

async function resumeRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to resume" }
  }
}

async function stopAfterCurrentRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/stop-after-current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to stop after current" }
  }
}

async function cancelStopAfterCurrentRalph(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/cancel-stop-after-current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    return await response.json()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel stop after current",
    }
  }
}

// Helper Functions

/**
 * Determines which buttons should be enabled based on current status.
 */
function getButtonStates(status: RalphStatus, isConnected: boolean) {
  // If not connected, disable all buttons
  if (!isConnected) {
    return {
      start: false,
      pause: false,
      stop: false,
      stopAfterCurrent: false,
    }
  }

  switch (status) {
    case "stopped":
      return {
        start: true,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
    case "starting":
      return {
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
    case "running":
      return {
        start: false,
        pause: true,
        stop: true,
        stopAfterCurrent: true,
      }
    case "paused":
      return {
        start: false,
        pause: true, // Acts as resume when paused
        stop: true,
        stopAfterCurrent: true,
      }
    case "stopping":
      return {
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
    case "stopping_after_current":
      return {
        start: false,
        pause: false,
        stop: true, // Allow immediate stop to cancel
        stopAfterCurrent: true, // Allow canceling the stop-after-current
      }
    default:
      return {
        start: false,
        pause: false,
        stop: false,
        stopAfterCurrent: false,
      }
  }
}

// ControlBar Component

/**
 * Control bar with buttons for Start, Pause, Stop, and Stop-after-current.
 * Button states are disabled based on ralph status.
 */
export function ControlBar({ className }: ControlBarProps) {
  const status = useAppStore(selectRalphStatus)
  const isConnected = useAppStore(selectIsConnected)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getHotkeyDisplay } = useHotkeys({ handlers: {} })

  const buttonStates = getButtonStates(status, isConnected)

  const handleStart = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await startRalph()
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error || "Failed to start")
    }
  }, [])

  const handlePause = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    // Toggle between pause and resume based on current status
    const result = status === "paused" ? await resumeRalph() : await pauseRalph()
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error || (status === "paused" ? "Failed to resume" : "Failed to pause"))
    }
  }, [status])

  const handleStop = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await stopRalph()
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error || "Failed to stop")
    }
  }, [])

  const handleStopAfterCurrent = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    // Toggle between stop-after-current and cancel (restart) based on current status
    const result =
      status === "stopping_after_current" ?
        await cancelStopAfterCurrentRalph()
      : await stopAfterCurrentRalph()
    setIsLoading(false)
    if (!result.ok) {
      setError(
        result.error ||
          (status === "stopping_after_current" ?
            "Failed to cancel stop after current"
          : "Failed to stop after current"),
      )
    }
  }, [status])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Start button */}
      <TooltipButton tooltip="Start" hotkey={getHotkeyDisplay("agentStart")}>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleStart}
          disabled={!buttonStates.start || isLoading}
          aria-label="Start"
        >
          <IconPlayerPlayFilled className="size-4" />
        </Button>
      </TooltipButton>

      {/* Pause/Resume button */}
      <TooltipButton
        tooltip={status === "paused" ? "Resume" : "Pause"}
        hotkey={getHotkeyDisplay("agentPause")}
      >
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handlePause}
          disabled={!buttonStates.pause || isLoading}
          aria-label={status === "paused" ? "Resume" : "Pause"}
        >
          {status === "paused" ?
            <IconPlayerPlayFilled className="size-4" />
          : <IconPlayerPauseFilled className="size-4" />}
        </Button>
      </TooltipButton>

      {/* Stop button */}
      <TooltipButton tooltip="Stop" hotkey={getHotkeyDisplay("agentStop")}>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleStop}
          disabled={!buttonStates.stop || isLoading}
          aria-label="Stop"
        >
          <IconPlayerStopFilled className="size-4" />
        </Button>
      </TooltipButton>

      {/* Stop after current button */}
      <TooltipButton
        tooltip={
          status === "stopping_after_current" ? "Cancel stop after current" : "Stop after current"
        }
        hotkey={getHotkeyDisplay("agentStopAfterCurrent")}
      >
        <Button
          variant={status === "stopping_after_current" ? "default" : "outline"}
          size="icon-sm"
          onClick={handleStopAfterCurrent}
          disabled={!buttonStates.stopAfterCurrent || isLoading}
          aria-label={
            status === "stopping_after_current" ? "Cancel stop after current" : "Stop after current"
          }
        >
          <IconPlayerStop className="size-4" />
        </Button>
      </TooltipButton>

      {/* Error display */}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  )
}
