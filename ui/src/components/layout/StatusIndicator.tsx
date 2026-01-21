import { cn } from "@/lib/utils"
import { useAppStore, selectRalphStatus } from "@/store"

export function StatusIndicator({}: Props) {
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
    pausing: {
      color: "bg-status-warning animate-pulse",
      label: "Pausing",
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

type Props = {}
