import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  useAppStore,
  selectRalphStatus,
  selectWorkspace,
  selectBranch,
  selectTokenUsage,
  selectContextWindow,
  selectIteration,
  selectRunStartedAt,
  selectCurrentTask,
} from "@/store"
import { ControlBar } from "@/components/controls/ControlBar"
import { IconGitBranch, IconClock } from "@tabler/icons-react"

// Types

export interface StatusBarProps {
  className?: string
}

// Helper Functions

/**
 * Formats a token count with k/M suffixes for readability.
 */
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`
  }
  return count.toString()
}

/**
 * Extracts the repo name from a workspace path.
 */
function getRepoName(workspace: string | null): string | null {
  if (!workspace) return null
  return workspace.split("/").pop() || workspace
}

/**
 * Formats elapsed time in a human-readable format.
 * Shows seconds for < 1 minute, then minutes:seconds, then hours:minutes:seconds.
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

// StatusIndicator Component

function StatusIndicator() {
  const status = useAppStore(selectRalphStatus)

  const statusConfig = {
    stopped: {
      color: "bg-status-neutral",
      label: "Stopped",
    },
    starting: {
      color: "bg-status-warning animate-pulse",
      label: "Starting",
    },
    running: {
      color: "bg-status-success",
      label: "Running",
    },
    paused: {
      color: "bg-status-warning",
      label: "Paused",
    },
    stopping: {
      color: "bg-status-warning animate-pulse",
      label: "Stopping",
    },
    stopping_after_current: {
      color: "bg-status-warning",
      label: "Stopping after task",
    },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <span className={cn("size-2 rounded-full", config.color)} />
      <span className="text-muted-foreground text-xs">{config.label}</span>
    </div>
  )
}

// RepoBranch Component

function RepoBranch() {
  const workspace = useAppStore(selectWorkspace)
  const branch = useAppStore(selectBranch)

  const repoName = getRepoName(workspace)

  if (!repoName && !branch) return null

  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <IconGitBranch className="size-3 shrink-0" />
      <span className="max-w-[150px] truncate">
        {repoName}
        {branch && (
          <>
            <span className="mx-1 opacity-50">/</span>
            {branch}
          </>
        )}
      </span>
    </div>
  )
}

// TokenUsage Component

function TokenUsageDisplay() {
  const tokenUsage = useAppStore(selectTokenUsage)

  return (
    <div
      className="text-muted-foreground flex items-center gap-2 text-xs"
      title="Token usage (input / output)"
    >
      <span className="flex items-center gap-0.5">
        <span className="opacity-70">↓</span>
        <span>{formatTokenCount(tokenUsage.input)}</span>
      </span>
      <span className="flex items-center gap-0.5">
        <span className="opacity-70">↑</span>
        <span>{formatTokenCount(tokenUsage.output)}</span>
      </span>
    </div>
  )
}

// ContextWindowProgress Component

function ContextWindowProgress() {
  const contextWindow = useAppStore(selectContextWindow)

  // Don't show if no usage yet
  if (contextWindow.used === 0) return null

  const progress = (contextWindow.used / contextWindow.max) * 100
  const usedFormatted = formatTokenCount(contextWindow.used)
  const maxFormatted = formatTokenCount(contextWindow.max)

  // Color coding based on usage: green < 50%, yellow 50-80%, red > 80%
  const getProgressColor = () => {
    if (progress >= 80) return "bg-status-error"
    if (progress >= 50) return "bg-status-warning"
    return "bg-primary"
  }

  return (
    <div
      className="flex items-center gap-2"
      title={`Context window: ${usedFormatted} / ${maxFormatted} tokens (${progress.toFixed(1)}%)`}
      data-testid="context-window-progress"
    >
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className={cn("h-full transition-all duration-300", getProgressColor())}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">{usedFormatted}</span>
    </div>
  )
}

// IterationProgress Component

function IterationProgress() {
  const iteration = useAppStore(selectIteration)

  // Don't show if no total is set
  if (iteration.total === 0) return null

  const progress = (iteration.current / iteration.total) * 100

  return (
    <div
      className="flex items-center gap-2"
      title={`Iteration ${iteration.current} of ${iteration.total}`}
    >
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">
        {iteration.current}/{iteration.total}
      </span>
    </div>
  )
}

// RunDuration Component

function RunDuration() {
  const runStartedAt = useAppStore(selectRunStartedAt)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!runStartedAt) {
      setElapsed(0)
      return
    }

    // Update immediately
    setElapsed(Date.now() - runStartedAt)

    // Update every second
    const interval = setInterval(() => {
      setElapsed(Date.now() - runStartedAt)
    }, 1000)

    return () => clearInterval(interval)
  }, [runStartedAt])

  // Don't show if not running
  if (!runStartedAt) return null

  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs" title="Time running">
      <IconClock className="size-3 shrink-0" />
      <span>{formatElapsedTime(elapsed)}</span>
    </div>
  )
}

// CurrentTask Component

function CurrentTask() {
  const currentTask = useAppStore(selectCurrentTask)

  if (!currentTask) return null

  return (
    <div
      className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
      title="Current task"
    >
      <span className="shrink-0 font-mono opacity-70">{currentTask.id}</span>
      <span className="truncate">{currentTask.title}</span>
    </div>
  )
}

// StatusBar Component

/**
 * Bottom status bar showing run status, control buttons, current task, repo/branch, token usage, and iteration progress.
 */
export function StatusBar({ className }: StatusBarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 text-sm", className)}>
      {/* Left section: Control buttons, status, run duration, current task */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ControlBar />
        <StatusIndicator />
        <RunDuration />
        <CurrentTask />
      </div>

      {/* Right section: Repo/branch, token usage, context window, and iteration */}
      <div className="flex shrink-0 items-center gap-4">
        <RepoBranch />
        <TokenUsageDisplay />
        <ContextWindowProgress />
        <IterationProgress />
      </div>
    </div>
  )
}
