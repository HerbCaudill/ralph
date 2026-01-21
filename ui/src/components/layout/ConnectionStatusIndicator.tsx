import { cn } from "@/lib/utils"
import { useAppStore, selectConnectionStatus } from "@/store"
import type { ConnectionStatus } from "@/hooks/useWebSocket"

const connectionStatusConfig: Record<
  ConnectionStatus,
  { color: string; label: string; description: string }
> = {
  disconnected: {
    color: "bg-status-error",
    label: "Disconnected",
    description: "Connection lost. Attempting to reconnect...",
  },
  connecting: {
    color: "bg-status-warning animate-pulse",
    label: "Connecting",
    description: "Establishing connection to server...",
  },
  connected: {
    color: "bg-status-success",
    label: "Connected",
    description: "Connected to server",
  },
}

/**
 * Visual indicator showing WebSocket connection status.
 * Shows connected/connecting/disconnected states with appropriate colors.
 * Only shows the label when not connected to draw attention to connection issues.
 */
export function ConnectionStatusIndicator({ className }: ConnectionStatusIndicatorProps) {
  const connectionStatus = useAppStore(selectConnectionStatus)
  const config = connectionStatusConfig[connectionStatus]

  // Only show the full indicator (with label) when not connected
  // When connected, just show the dot to minimize visual noise
  const showLabel = connectionStatus !== "connected"

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={config.description}
      data-testid="connection-status-indicator"
    >
      <span
        className={cn("size-2 rounded-full", config.color)}
        data-testid="connection-status-dot"
      />
      {showLabel && (
        <span className="text-muted-foreground text-xs" data-testid="connection-status-label">
          {config.label}
        </span>
      )}
    </div>
  )
}

export type ConnectionStatusIndicatorProps = {
  className?: string
}
