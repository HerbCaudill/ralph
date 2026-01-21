import { useState, useCallback } from "react"
import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconPlayerStopFilled, IconPlayerStop } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TooltipButton } from "@/components/ui/tooltip"
import { useAppStore, selectRalphStatus, selectIsConnected } from "@/store"
import { useHotkeys } from "@/hooks"
import { cancelStopAfterCurrentRalph } from "@/lib/cancelStopAfterCurrentRalph"
import { getControlBarButtonStates } from "@/lib/getControlBarButtonStates"
import { pauseRalph } from "@/lib/pauseRalph"
import { resumeRalph } from "@/lib/resumeRalph"
import { startRalph } from "@/lib/startRalph"
import { stopAfterCurrentRalph } from "@/lib/stopAfterCurrentRalph"
import { stopRalph } from "@/lib/stopRalph"

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

  const buttonStates = getControlBarButtonStates(status, isConnected)

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
    const result =
      status === "paused" || status === "pausing" ? await resumeRalph() : await pauseRalph()
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error || "Failed to pause")
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
    const result =
      status === "stopping_after_current" ?
        await cancelStopAfterCurrentRalph()
      : await stopAfterCurrentRalph()
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error || "Failed to stop after current")
    }
  }, [status])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipButton
        tooltip={`Start${getHotkeyDisplay("agentStart")}`}
        onClick={handleStart}
        disabled={!buttonStates.start || isLoading}
        aria-label="Start Ralph"
      >
        <IconPlayerPlayFilled className="size-4" />
      </TooltipButton>

      <TooltipButton
        tooltip={`${status === "paused" || status === "pausing" ? "Resume" : "Pause"}${getHotkeyDisplay("agentPause")}`}
        onClick={handlePause}
        disabled={!buttonStates.pause || isLoading}
        aria-label={status === "paused" || status === "pausing" ? "Resume Ralph" : "Pause Ralph"}
      >
        <IconPlayerPauseFilled className="size-4" />
      </TooltipButton>

      <TooltipButton
        tooltip={`Stop${getHotkeyDisplay("agentStop")}`}
        onClick={handleStop}
        disabled={!buttonStates.stop || isLoading}
        aria-label="Stop Ralph"
      >
        <IconPlayerStopFilled className="size-4" />
      </TooltipButton>

      <TooltipButton
        tooltip={`${status === "stopping_after_current" ? "Cancel stop after current" : "Stop after current"}`}
        onClick={handleStopAfterCurrent}
        disabled={!buttonStates.stopAfterCurrent || isLoading}
        aria-label={
          status === "stopping_after_current" ?
            "Cancel stop after current"
          : "Stop after current"
        }
      >
        <IconPlayerStop className="size-4" />
      </TooltipButton>

      {error && <span className="text-status-error text-xs">{error}</span>}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleStopAfterCurrent}
        disabled={!buttonStates.stopAfterCurrent || isLoading}
        className="text-muted-foreground ml-2 h-7 px-2 text-xs"
      >
        {status === "stopping_after_current" ? "Cancel" : "Stop after current"}
      </Button>
    </div>
  )
}

type ControlBarProps = {
  className?: string
}
