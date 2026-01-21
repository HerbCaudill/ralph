import { cn } from "@/lib/utils"
import { ControlBar } from "@/components/controls/ControlBar"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { IterationProgress } from "./IterationProgress"
import { RepoBranch } from "./RepoBranch"
import { RunDuration } from "./RunDuration"
import { StatusIndicator } from "./StatusIndicator"
import { TokenUsageDisplay } from "./TokenUsageDisplay"

/**
 * Bottom status bar showing run status, control buttons, repo/branch, token usage, and iteration progress.
 */
export function StatusBar({ className }: StatusBarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 text-sm", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ControlBar />
        <StatusIndicator />
        <RunDuration />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <RepoBranch />
        <TokenUsageDisplay />
        <ContextWindowProgress />
        <IterationProgress />
      </div>
    </div>
  )
}

export type StatusBarProps = {
  className?: string
}
